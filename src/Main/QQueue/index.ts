import {
    Algodv2,
    Indexer,
    OnApplicationComplete,
    makeApplicationCreateTxn,
    makeApplicationOptInTxn,
    makeApplicationNoOpTxn,
    Transaction,
    makeApplicationNoOpTxnFromObject,
} from "algosdk";
import {
    intToByteArray,
    loadCompiledQueuePrograms,
    readGlobalQueueState,
    waitForConfirmation,
    decodeBase64,
    decodeValue,
    encodeString,
} from "../utils"
import {
   PUSH_SYM,
} from "./symbols"
import {
    config,
} from '../types'
import { sign } from "crypto";


class QQueue {
    private client: Algodv2;
    private indexerClient: Indexer;

    private signMethod: "myalgo" | "raw";
    private wallet: any;
    private appID: number;
    private size: number;
    private decisionIDS: number[];
    private creatorAddress: string;
    private deployTxID : string;
    private currentIndex: number; 

    static newQueue(conf: config, size: number, creatorAddress: string, wallet?: any) : QQueue {
        return new this(conf, wallet, undefined, size, creatorAddress);
    }

    static existingQueue(conf: config, appID: number, wallet?: any) : QQueue {
        return new this(conf, wallet, appID);
    }

    private constructor(conf: config, wallet?: any, appID?: number, size?: number, creatorAddress?: string){ 

        // TODO client and indexer should be shared in the util, 
        // and we could pass a referecnce to the helper object to both the 
        const { token, baseServer, port } = conf;
        this.client = new Algodv2(token, baseServer, port); 
        this.indexerClient = new Indexer(token, baseServer, port);

        this.signMethod = typeof wallet != "undefined" ? "myalgo" : "raw";
        this.wallet = wallet;

        if (typeof appID != 'undefined'){
            this.appID = appID;
        } else {
            this.size = size;
            this.creatorAddress = creatorAddress
        }
    }

    async init(appID?: number){
        if (typeof appID != 'undefined'){
            if (typeof this.appID != 'undefined' && this.appID != appID){
                throw 'trying to initialize with a different appID than the one already set';
            }
            this.appID = appID; 
        }

        await this.fetchState()
    }

    async fetchState(){
        if (typeof this.appID == 'undefined'){
            throw 'Queue has not been initialized yet'
        }

        const appData = await this.indexerClient.lookupApplications(this.appID).do();
        this.creatorAddress = appData.params.creator;
        const globalState = appData.params['global-state']
                            .reduce((acc, { key, value }) => {
                                const decodedKey = decodeBase64(key);
                                // const decodedValue = decodedKey == "Name" ? decodeValue(value) : value;
                                acc[decodedKey] = value;
                                return acc;
                            }, {})

        this.size = globalState.size.uint;
        this.currentIndex = globalState.index.uint;
        // NOTE this assumes there are no other key-values in the state besides these 3 kinds
        //@ts-ignore
        this.decisionIDS = Object.entries(globalState).map(
            ([key, value]) => {
                if (key!='index' && key!='size'){
                    // @ts-ignore 
                    return [key, parseInt(decodeBase64(value.bytes))]
                }
            })
            .filter(v => typeof v != 'undefined')
            .sort(
                (a, b) => {
                    if (a>b) return 1;
                    if (a<b) return -1;
                    return 0;
                }
            )
            .map(v => v[1])
    }

     /**
     * 
     * @returns appID for this QQueue 
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

    async buildDeployTx(){
        const {approval, clearState} = loadCompiledQueuePrograms();

        const localInts = 1;
        const localBytes = 1;
        const globalInts = this.size;
        const globalBytes = this.size;
        const appArgs = [intToByteArray(this.size, 1)]

        const txParams = await this.client.getTransactionParams().do();
        const tx = makeApplicationCreateTxn(
            this.creatorAddress, 
            txParams, 
            OnApplicationComplete.NoOpOC,
            approval, 
            clearState, 
            localInts, 
            localBytes,
            globalInts, 
            globalBytes, 
            appArgs
        )
        this.deployTxID = tx.txID().toString();
        return tx;
    }

    async getDecisions() : Promise<number[]>{
        await this.fetchState();
        return this.decisionIDS;
    }

    async getSize() {
        if (typeof this.size != 'undefined'){
            return this.size;
        } else {
            throw 'Queue instance has not been initialized yet'
        }
    }

    async buildPushTx(userAddress: string, decisionAppID: number) {
        const txParams = await this.client.getTransactionParams().do();
        const appArgs = [PUSH_SYM, decisionAppID.toString()].map(encodeString)
        const tx = makeApplicationNoOpTxn(userAddress, txParams, this.appID, appArgs)
        return tx;
    }

    async buildOptinTx(address: string){
        const txParams = await this.client.getTransactionParams().do();
        const tx = makeApplicationOptInTxn(address, txParams, this.appID)
        return tx;
    }

    async deployNew(){
        const txParams = await this.client.getTransactionParams().do();
        var tx = await this.buildDeployTx();

        ///@ts-ignore
        tx['from'] = this.creatorAddress;

        //@ts-ignore
        tx['genesisHash'] = txParams['genesisHash']

        const signedTx = await this.wallet.signTransaction(tx);
        const txID = signedTx.txID;
        this.deployTxID = signedTx.txID;

        //TODO update deployTxID
        await this.sendSignedTx(signedTx.blob);
        await this.waitForConfirmation(txID);

        const appID = await this.getAppID()
        await this.init(appID);
        
        return appID;
    }

    async optIn(userAddress : string) {

        const txParams = await this.client.getTransactionParams().do();
        var tx = await this.buildOptinTx(userAddress);
        const signedTx = await this.wallet.signTransaction(tx);
        const txID = signedTx.txID;

        //@ts-ignore
        tx['from'] = userAddress;
        //@ts-ignore
        tx['genesisHash'] = txParams['genesisHash']
        
        await this.sendSignedTx(signedTx.blob);
        await this.waitForConfirmation(txID);

    }

    async push(userAddress: string, decisionAppID: number) : Promise<void> {
        // make sure instance is initialized
        if (typeof this.appID == 'undefined'){
            throw "instance is not initialized"
        }
        const txParams = await this.client.getTransactionParams().do();

        var pushTx = await this.buildPushTx(userAddress, decisionAppID);

        //@ts-ignore 
        pushTx['from'] = userAddress;

        //@ts-ignore
        pushTx['genesisHash'] = txParams['genesisHash']

        const signedTx = await this.wallet.signTransaction(pushTx);
        const txID = signedTx.txID;
        await this.sendSignedTx(signedTx.blob);
        await this.waitForConfirmation(txID);
    }

    // TODO like all other methods that simply use a client, this should go in utils once utils has it's own client 
    async sendSignedTx(tx: Uint8Array | Uint8Array[]): Promise<void> {
        await this.client.sendRawTransaction(tx).do();
    }

    async waitForConfirmation(txId): Promise<void> {
        await waitForConfirmation(this.client, txId);
    }

}
export {QQueue}