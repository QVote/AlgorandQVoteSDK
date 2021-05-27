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
    readGlobalState,
    buildAddOptionTxFunc,
    groupOptions,
    loadCompiledPrograms,
    encodeString,
    waitForConfirmation,
} from "./utils";

import { QVoteState, QVoteParams, config, Address } from "./types";
import * as symbols from "./symbols";

class QVoting {
    private client: Algodv2;
    private deployTxId: string;
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

    /*
     * Call this after creating the object to get it's state from the blockchain.
     * Pass either the appID of newly deployed transactions from the parameters,
     * or the appID of an existing qvote decision on the blockchain.
     */
    async initState(appID: number): Promise<void> {
        this.appID = appID;
        // TODO fill the state form the app data, don't make another call
        const appData = await this.indexerClient.lookupApplications(appID).do();
        console.log(appData);

        this.creatorAddress = appData.params.creator;
        if (typeof this.state == "undefined") {
            this.state = await this.readGlobalState();
        }
    }

    /*
     * takes one grouped option entry and returns arguments to be passed to build the tx
     */
    buildQVoteDeployArgs(options: string[]): Uint8Array[] {
        // assert(options.length <= 5)
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

    getOptionTitles(): string[] {
        return this.state.options.map((o) => o.title);
    }

    /*
     * Returns an unsigned transaction for deploying a QVote decision
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
        const { approval, clearState } = loadCompiledPrograms();
        const onComplete = OnApplicationComplete.NoOpOC;
        const params = await this.client.getTransactionParams().do();

        const localInts = 1;
        const localBytes = 1;
        const globalInts = options.length + 4;
        const globalBytes = 3;

        const appArgs = this.buildQVoteDeployArgs(groupedOptions[0]);
        console.log(appArgs);
        console.log(typeof appArgs);
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
        this.deployTxId = appCreateTx.txID().toString(); // this is valid only if signing using algosdk, otherwise it will be overridden

        // Add option tx generator functions
        const addOptionFns = groupedOptions
            .slice(1)
            .map((o) => buildAddOptionTxFunc(this.creatorAddress, params, o));
        return { appCreateTx: appCreateTx, addOptionFns: addOptionFns };
    }

    private async myAlgoPreprocessAddOptionTxs(
        txs: Transaction[]
    ): Promise<Transaction[]> {
        return this.processTx(txs, decodeAddress(this.creatorAddress));
    }

    private async myAlgoPreprocessVoteTxs(
        txs: Transaction[],
        userAddress: string
    ): Promise<Transaction[]> {
        return this.processTx(txs, decodeAddress(userAddress));
    }

    private async processTx(
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
        this.deployTxId = signedTxn.txID; // overriding with the new txId

        console.log(signedTxn);
        console.log("Signed transaction with txID: %s", this.deployTxId);

        await this.sendSignedTx(signedTxn.blob);
        console.log("SENT");

        await this.waitForConfirmation(this.deployTxId);
        console.log("confirmed");

        this.appID = await this.getAppId();

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

    async buildOptInTx(userAddress: string): Promise<Transaction> {
        const params = await this.client.getTransactionParams().do();
        const txn = makeApplicationOptInTxn(userAddress, params, this.appID);
        return txn;
    }

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
        console.log(tx);

        const signedTxn = await this.wallet.signTransaction(tx);
        const txID = signedTxn.txID;

        console.log(signedTxn);
        console.log("Signed transaction with txID: %s", this.deployTxId);

        await this.sendSignedTx(signedTxn.blob);
        console.log("SENT");

        await this.waitForConfirmation(txID);
    }

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

    async sendSignedTx(tx: Uint8Array | Uint8Array[]): Promise<void> {
        await this.client.sendRawTransaction(tx).do();
    }

    async waitForConfirmation(txId): Promise<void> {
        await waitForConfirmation(this.client, txId);
    }

    async getAppId(): Promise<number> {
        if (typeof this.appID != "undefined") {
            return this.appID;
        }
        // instance has been created from scratch. checking if the app has been deployed
        if (typeof this.deployTxId != "undefined") {
            const transactionResponse = await this.client
                .pendingTransactionInformation(this.deployTxId)
                .do();
            this.appID = transactionResponse["application-index"];
            return this.appID;
        } else {
            console.log("Contract has not been deployed yet");
        }
    }

    async readGlobalState(): Promise<QVoteState> {
        return await readGlobalState(
            this.client,
            this.creatorAddress,
            this.appID
        );
    }
}

export { QVoting };
