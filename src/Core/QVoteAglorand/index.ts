import {QVotingApprovalTeal, QVotingClearStateTeal} from "../../ContractCode";
import * as algosdk from "algosdk";
import {intToByteArray, 
		resultsFromState, readGlobalState, buildAddOptionTxFunc, 
		groupOptions, loadCompiledPrograms, encodeNumber, 
		encodeString, waitForConfirmation, QVoteState} from "./utils"
import * as assert from "assert"

import {ADD_OPTION_SYM, OPTION_SYM, NULL_OPTION_SYM} from "./symbols"


/*
 * Parameters of the contract for QVoting.
 */
// type QVoteParams = QVoteState & {options: string[]}      // replace options 

// TODO can we declare this in terms of QVoteState, basically the same thing with options : {title: string, value: number}[]
export type QVoteParams = { // TODO convert these to camelCase at one point 
	decisionName: string,
	votingStartTime: number, 
	votingEndTime: number, 
	assetID: number, 
	assetCoefficient: number,
	options: string[]
}

interface config {
	token: any, 
	baseServer: any, 
	port: any
}			

interface params {
	newDecisionParams: QVoteParams | undefined,
	appID: number | undefined
}

class QVoting{

	private millisecondsPerTxBlockAverage: number; 
	private client: any;    // this client cannot sign transactions. It is simply used to call the apis 
	private deployTxId: string; 
	private appID: number; 
	private creatorAddress: string; 
	private state: QVoteState; 

	/*
	 * Create a new QVote object from scratch, or create one from an already deployed app by providing the appID
	 */
	// TODO can we get the creatorAddress from the appID? 
	constructor(creatorAddress: string, millisecondsPerTxBlockAverage: number, conf: config, params? : QVoteParams){
		const {token, baseServer, port} = conf; 
		this.millisecondsPerTxBlockAverage = millisecondsPerTxBlockAverage;
		this.client = new algosdk.Algodv2(token, baseServer, port); // TODO take client params from config file 
		this.creatorAddress = creatorAddress;
		
		if (typeof params != 'undefined') {
			this.state = {
				...params, 
				options: params.options.map(title => ({title, value: 0}))
			}
		}
		// TODO automatically call buildDeployTxs and return them if params is passed 
	}

	/*
	 * Call this after creating the object to get it's state from the blockchain. 
	 * Pass either the appID of newly deployed transactions from the parameters,
	 * or the appID of an existing qvote decision on the blockchain. 
	 */
	async initState(appID : number){
		this.appID = appID;
		if (typeof this.state == 'undefined'){
			this.state = await this.readGlobalState(); 
		}
	}

	getName(): string {
		return this.state.decisionName; 
	}

	getOptionTitles() : string[]{
		return this.state.options.map(o => o.title); 	
	}

	// TODO make other getters 

	getFutureTxBlockNumber(blockNumber: number, millisecondsToAdd: number): string {
        return "" + blockNumber + Math.round((millisecondsToAdd / this.millisecondsPerTxBlockAverage));
    }

	/*
	 * takes one grouped option entry and returns arguments to be passed to build the tx 
	 */
	buildQVoteDeployArgs(options: string[]) : Uint8Array[]{
		assert(options.length <= 5) 
		const appArgs = [encodeString(this.state.decisionName)]
							.concat(options.map(encodeString))
							.concat([this.state.assetID, this.state.assetCoefficient, 
									this.state.votingStartTime, this.state.votingEndTime]
									.map((n) => intToByteArray(n, 8)))
		return appArgs;
	}

	/*
	 * Returns an unsigned transaction for deploying a QVote decision 
	 */
	async buildDeployTx(){
		// Even though we are using state here, we don't have to initialize. You shouldn't call this method if you created the object with an appID
		// TODO, maybe we should make to classes that inherit a base QVoteSDK, one for existing contracts, another for new ones. 
		// A function could feed either one based on the parameters passed
		
		const {decisionName, votingStartTime, votingEndTime, assetID, assetCoefficient, options} = this.state;
		assert(options.length <= 57)    // won't fit in the contract otherwise 
		var txs = []

		// Application Creation tx 
		const groupedOptions = groupOptions(this.getOptionTitles());
		const {approval, clearState} = loadCompiledPrograms();
		const onComplete = algosdk.OnApplicationComplete.NoOpOC;
		const params = await this.client.getTransactionParams().do();

		const localInts = 1;
		const localBytes = 1;
		const globalInts = options.length + 4
		const globalBytes = 3;
		
		const appArgs = this.buildQVoteDeployArgs(groupedOptions[0])
		const appCreateTx =  algosdk.makeApplicationCreateTxn(this.creatorAddress, params, onComplete, 
												approval, clearState, 
												localInts, localBytes, globalInts, globalBytes, 
												appArgs); 

		this.deployTxId = appCreateTx.txID().toString();

		// Add option tx generator functions 
		const addOptionFns = groupedOptions.slice(1).map((o) => buildAddOptionTxFunc(this.creatorAddress, params, o))
		return {appCreateTx: appCreateTx, addOptionFns: addOptionFns};
	}

	// do everything in one function, using algosigner. This is for user convenience, if they trust us to sign things with algosigner 
	// async deployNewDecision()
	
	getDeployTxId(){
		return this.deployTxId; 
	}

	async buildVoteTxs(options: string[]){
	}

	async sendSignedTx(tx){
		await this.client.sendRawTransaction(tx).do();
	}

	async waitForConfirmation(txId){
		await waitForConfirmation(this.client, txId);
	}

	async getAppId(){
		if (typeof this.appID != 'undefined'){
			return this.appID;
		}
		// instance has been created from scratch. checking if the app has been deployed 
		if (typeof this.deployTxId != 'undefined') {
			const transactionResponse = await this.client.pendingTransactionInformation(this.deployTxId).do();
			this.appID = transactionResponse['application-index']; 
			return this.appID; 
		} else {
			console.log("Contract has not been deployed yet")
		}
	}

	async readGlobalState(){
		return await readGlobalState(this.client, this.creatorAddress, this.appID);
	}

	async getCurrentResults(){
		const state = await this.readGlobalState(); 
		return resultsFromState(state);
	}
}

export {QVoting}; 
