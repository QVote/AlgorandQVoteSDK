import {
    Algodv2,
    Indexer,
    OnApplicationComplete,
    makeApplicationCreateTxn,
    makeApplicationOptInTxn,
    makeApplicationNoOpTxn,
    Transaction,
    decodeAddress,
} from "algosdk";
import {
    intToByteArray,
    readLocalStorage,
    readGlobalQVoteState,
    buildAddOptionTxFunc,
    groupOptions,
    loadCompiledQVotePrograms,
    encodeString,
    waitForConfirmation,
} from "../utils";

import { QVoteState, QVoteParams, config, Address } from "../types";
import * as symbols from "./symbols";

class QVoting {
    private client: Algodv2;
    private deployTxID: string;
    private appID: number;
    private creatorAddress: string;
    state: QVoteState;
    private signMethod: "myalgo" | "raw";
    private wallet: any;
    private indexerClient: Indexer;

    private decimalPlaces = 1;

    /*
     * Create a new QVote object from scratch, or create one from an already deployed app by providing the appID
     */
    constructor(conf: config, wallet?: any, params?: QVoteParams) {
        const { token, baseServer, port } = conf;
        this.client = new Algodv2(token, baseServer, port); // TODO take client params from config file
        this.indexerClient = new Indexer(token, baseServer, port);

        this.signMethod = typeof wallet != "undefined" ? "myalgo" : "raw"; // NOTE right now there are only two ways of signing
        this.wallet = wallet;

        if (typeof params != "undefined") {
            // deploying a new contract
            this.creatorAddress = params.creatorAddress;

            this.state = {
                ...params,
                options: params.options.map((title) => ({ title, value: 0 })),
            };
        }
    }

    /**
     * Call this after creating the object to get it's state from the blockchain
     * or after deploying the app create transactions
     * @param appID of a previously deployer qvote decision
     */
    async initState(appID: number): Promise<void> {
        this.appID = appID;
        // TODO fill the state form the app data, don't make another call
        const appData = await this.indexerClient.lookupApplications(appID).do();

        this.creatorAddress = appData.params.creator;
        if (typeof this.state == "undefined") {
            this.state = await this.readGlobalState();
        }
    }

    /**
     * @param options list of options to be voted upon in the decision
     * @returns application call arguments to build the deploy transactions
     */
    private buildQVoteDeployArgs(options: string[]): Uint8Array[] {
        if (options.length > 5) {
            throw "Options can be at most 5 at creation. Build other AddOption txs for the remaining ones.";
        }
        const appArgs = [encodeString(this.state.decisionName)]
            .concat(options.map(encodeString))
            .concat(
                [
                    this.state.assetID,
                    this.state.assetCoefficient,
                    this.state.votingStartTime,
                    this.state.votingEndTime,
                ].map((n) => intToByteArray(n, 8))
            );
        return appArgs;
    }

    /**
     * 
     * @returns list of options to vote upon in the decision
     */
    getOptionTitles(): string[] {
        return this.state.options.map((o) => o.title);
    }

    /**
     * 
     * @returns unsigned deploy transactions, both appCreate and addOption tx generators
     */
    async buildDeployTxs(): Promise<{
        appCreateTx: Transaction;
        addOptionFns: ((appID: number) => Transaction)[];
    }> {
        const { options } = this.state;
        if (options.length >= 57) {
            throw "too many options, limit is 57"; // TODO check this
        }

        // Application Creation tx
        const groupedOptions = groupOptions(this.getOptionTitles());
        const { approval, clearState } = loadCompiledQVotePrograms();
        const onComplete = OnApplicationComplete.NoOpOC;
        const params = await this.client.getTransactionParams().do();

        const localInts = 1;
        const localBytes = 1;
        const globalInts = options.length + 4;
        const globalBytes = 3;

        const appArgs = this.buildQVoteDeployArgs(groupedOptions[0]);
        const appCreateTx = makeApplicationCreateTxn(
            this.creatorAddress,
            params,
            onComplete,
            approval,
            clearState,
            localInts,
            localBytes,
            globalInts,
            globalBytes,
            appArgs
        );

        // this is valid only if signing using raw signing method, otherwise it will be overridden
        this.deployTxID = appCreateTx.txID().toString(); 

        // Add option tx generator functions
        const addOptionFns = groupedOptions
            .slice(1)
            .map((o) => buildAddOptionTxFunc(this.creatorAddress, params, o));
        return { appCreateTx: appCreateTx, addOptionFns: addOptionFns };
    }

    /**
     * 
     * @param txs addOption transactions that will be signed with myalgo
     * @returns modified version of txs, compatible with myalgo
     */
    private async myAlgoPreprocessAddOptionTxs(
        txs: Transaction[]
    ): Promise<Transaction[]> {
        return this.updateFromAndGenesisHash(txs, decodeAddress(this.creatorAddress));
    }

    /**
     * 
     * @param txs vote txs that will be signed using myalgo
     * @param userAddress address of the voter (and signer)
     * @returns modified version of txs compatible with myalgo 
     */
    private async myAlgoPreprocessVoteTxs(
        txs: Transaction[],
        userAddress: string
    ): Promise<Transaction[]> {
        return this.updateFromAndGenesisHash(txs, decodeAddress(userAddress));
    }

    /**
     * changes 'from' and 'genesisHash' fields for compatibility with web  
     * @param txs 
     * @param from address of the sender as a string
     * @returns modified txs 
     */
    private async updateFromAndGenesisHash(
        txs: Transaction[],
        from: Address
    ): Promise<Transaction[]> {
        const txParams = await this.client.getTransactionParams().do();
        return txs.map((tx) => {
            tx["from"] = from;
            tx["genesisHash"] = Buffer.from(txParams["genesisHash"]);
            return tx;
        });
    }


    /**
     * deploys a new qvote contract, handles the whole thing for you. 
     * Must be using a signer. 
     */
    async deployNew(): Promise<void> {
        if (typeof this.state == "undefined") {
            console.log("cannot create ");
        }
        if (this.signMethod == "raw") {
            throw "Can't deploy without wallet signing. You should probably call buildDeployTxs, then sign and send the txs yourself";
        }

        const { appCreateTx, addOptionFns } = await this.buildDeployTxs();

        // Creating Application
        console.log("deploying app");
        appCreateTx["from"] = decodeAddress(this.creatorAddress);
        delete appCreateTx["appIndex"]; // apparently it thinks this is an app call otherwise

        console.log(appCreateTx);
        const signedTxn = await this.wallet.signTransaction(appCreateTx);
        this.deployTxID = signedTxn.txID; // overriding with the new txId

        console.log(signedTxn);
        console.log("Signed transaction with txID: %s", this.deployTxID);

        await this.sendSignedTx(signedTxn.blob);
        console.log("SENT");

        await this.waitForConfirmation(this.deployTxID);
        console.log("confirmed");

        this.appID = await this.getAppID();

        // Adding Options
        if (addOptionFns.length > 0) {
            console.log("adding options");

            const addOptionTxs = await this.myAlgoPreprocessAddOptionTxs(
                addOptionFns.map((f) => f(this.appID))
            );
            console.log("good", addOptionTxs);

            // if length is 1 don't use map later down.
            const signedAddOtionTxs = await this.wallet.signTransaction(
                addOptionTxs
            );
            console.log("signed", signedAddOtionTxs);

            const addOptiontxIDs = signedAddOtionTxs.map((tx) => tx.txID);

            signedAddOtionTxs.map((tx) => this.sendSignedTx(tx.blob));
            addOptiontxIDs.map((txID) => {
                this.waitForConfirmation(txID);
            });
        }

        console.log("done");
    }

    /**
     * 
     * @param userAddress user to be opted in
     * @returns unsigned opt in transactions 
     */
    async buildOptInTx(userAddress: string): Promise<Transaction> {
        const params = await this.client.getTransactionParams().do();
        const txn = makeApplicationOptInTxn(userAddress, params, this.appID);
        return txn;
    }

    /**
     * opts in (or is it optins?) a user. Handles the whole thing for you
     * Must be using a signer. 
     * @param userAddress user that wants to optin
     */
    async optIn(userAddress: string): Promise<void> {
        const tx = await this.buildOptInTx(userAddress);
        console.log(tx);

        const txParams = await this.client.getTransactionParams().do();
        tx["from"] = decodeAddress(userAddress);
        tx["genesisHash"] = Buffer.from(txParams["genesisHash"]);
        tx["appArgs"] = [];
        delete tx["tag"];
        delete tx["lease"];
        delete tx["note"];

        const signedTxn = await this.wallet.signTransaction(tx);
        const txID = signedTxn.txID;

        await this.sendSignedTx(signedTxn.blob);
        await this.waitForConfirmation(txID);
    }

    /**
     * 
     * @param userAddress address of the user voting (that will sign the transaction)
     * @param options option names and corresponding credits spent 
     * @returns a list of unsigned transactions to vote for the corresponding options the appropriate amounts
     */
    async buildVoteTxs(
        userAddress: string,
        options: { optionTitle: string; creditNumber: number }[]
    ): Promise<Transaction[]> {
        const params = await this.client.getTransactionParams().do();
        return options.map((o) =>
            makeApplicationNoOpTxn(userAddress, params, this.appID, [
                encodeString(symbols.VOTE_SYM),
                encodeString(o.optionTitle),
                // votes are multiplied to whatever decimal places are being displayed
                intToByteArray(
                    Math.round(
                        10 ** this.decimalPlaces *
                            Math.sqrt(Math.abs(o.creditNumber))
                    ),
                    3
                ),
                encodeString(Math.sign(o.creditNumber) < 0 ? "-" : "+"),
            ])
        );
    }

    /**
     * Votes on behalf of this user for given options. Handles everything for you
     * Has to be called with a signer. 
     * @param userAddress address of user that will vote
     * @param options options and corresponding credits spent on them
     */
    async vote(
        userAddress: string,
        options: { optionTitle: string; creditNumber: number }[]
    ): Promise<void> {
        const txs = await this.myAlgoPreprocessVoteTxs(
            await this.buildVoteTxs(userAddress, options),
            userAddress
        );

        const signedTxs = await this.wallet.signTransaction(txs);
        const addOptiontxIDs = signedTxs.map((tx) => tx.txID);

        console.log(signedTxs);
        signedTxs.map((tx) => this.sendSignedTx(tx.blob));
        addOptiontxIDs.map((txID) => {
            this.waitForConfirmation(txID);
        });
        console.log("voted");
    }

    /**
     * 
     * @param userAddress address for which we want to know the balance
     * @returns object mapping qvote credits symbol to the corresponding balance 
     */
    async getUserBalance(userAddress: string): Promise<{
        [x: number]: any;
    }> {
        const storage = await readLocalStorage(
            this.client,
            userAddress,
            this.appID
        );
        if (typeof storage == "undefined") {
            console.log(
                "user is not registered. Have you waited for the optin tx to confirm?"
            );
        } else {
            // storage will always be length 1 if the app is qvote. unless we extend the fuctionality of qvote. then we will update this sdk.
            return { [storage[0].key]: storage[0].value.uint };
        }
    }

    // TODO this should be in the signer, using shared client 
    /**
     * Deploys an already signed transaction
     * @param tx signed tx to be sent 
     */
    async sendSignedTx(tx: Uint8Array | Uint8Array[]): Promise<void> {
        await this.client.sendRawTransaction(tx).do();
    }

    /**
     * resolves when the transaction has been confirmed  
     * @param txId id of waiting transaction
     */
    async waitForConfirmation(txId): Promise<void> {
        await waitForConfirmation(this.client, txId);
    }

    /**
     * 
     * @returns appID for this QVote decision
     */
    async getAppID(): Promise<number> {
        if (typeof this.appID != "undefined") {
            return this.appID;
        }
        // instance has been created from scratch. checking if the app has been deployed
        if (typeof this.deployTxID != "undefined") {
            const transactionResponse = await this.client
                .pendingTransactionInformation(this.deployTxID)
                .do();
            this.appID = transactionResponse["application-index"];
            return this.appID;
        } else {
            console.log("Contract has not been deployed yet");
        }
    }

    /**
     * 
     * @returns global state of the corresponding decision contract for the instance
     */
    async readGlobalState(): Promise<QVoteState> {
        this.state = await readGlobalQVoteState(
            this.client,
            this.creatorAddress,
            this.appID
        );
        return this.state; 
    }
}

export { QVoting };
