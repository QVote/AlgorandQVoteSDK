import {QVotingApprovalTeal, QVotingClearStateTeal} from "../../ContractCode";
import * as algosdk from "algosdk";
import {readGlobalState, buildAddOptionTxFunc,  groupOptions, loadCompiledPrograms, encodeNumber, encodeString, waitForConfirmation} from "./utils"
import * as assert from "assert"


class QVoting{
	private millisecondsPerTxBlockAverage: number; 
	private client: any;    // this client cannot sign transactions. It is simply used to call the apis 
	private deployTxId: string; 
	private appID: number; 
	private creatorAddress: string; 

	/*
	 * Create a new QVote object from scratch, or create one from an already deployed app by providing the appID
	 */
	constructor(millisecondsPerTxBlockAverage: number, creatorAddress: string, token, baseServer, port, appID=undefined){ 
		this.millisecondsPerTxBlockAverage = millisecondsPerTxBlockAverage;
		this.client = new algosdk.Algodv2(token, baseServer, port); // TODO take client params from config file 
		// TODO automatically call the deploytx if appID is undefined 
		this.creatorAddress = creatorAddress;
		this.appID = appID
	}

	getFutureTxBlockNumber(blockNumber: number, millisecondsToAdd: number): string {
        return "" + blockNumber + Math.round((millisecondsToAdd / this.millisecondsPerTxBlockAverage));
    }

	buildQVoteDeployArgs(decisionName: string, options: string[],
					  startTime: number, endTime: number, 
					  assetId: number, assetCoefficient: number) : Uint8Array[]{

		assert(options.length <= 5) 
		const appArgs = [encodeString(decisionName)]
							.concat(options.map(encodeString))
							.concat([assetId, assetCoefficient, startTime, endTime].map(encodeNumber))
		return appArgs;
	}

	/*
	 E Returns an unsigned transaction for deploying a QVote decision 
	 */
	async buildDeployTx(creatorAddress: string,
						startTime: number, registrationSeconds: number,
						assetId: number, assetCoefficient: number, 
						decisionName: string, options: string[]) {
									 
		assert(options.length <= 57)    // won't fit in the contract otherwise 
		var txs = []

		// Application Creation tx 
		const groupedOptions = groupOptions(options);
		const {approval, clearState} = loadCompiledPrograms();
		const onComplete = algosdk.OnApplicationComplete.NoOpOC;
		const params = await this.client.getTransactionParams().do();

		const localInts = 1;
		const localBytes = 1;
		const globalInts = options.length + 4
		const globalBytes = 3;
		const endTime = startTime + registrationSeconds
		
		console.log(groupedOptions[0].length) 
		const appArgs = this.buildQVoteDeployArgs(decisionName, groupedOptions[0], startTime, endTime, assetId, assetCoefficient);
		const appCreateTx =  algosdk.makeApplicationCreateTxn(creatorAddress, params, onComplete, 
												approval, clearState, 
												localInts, localBytes, globalInts, globalBytes, 
												appArgs); 

		this.deployTxId = appCreateTx.txID().toString();

		// Add option tx generator functions 
		const addOptionFns = groupedOptions.slice(1).map((o) => buildAddOptionTxFunc(creatorAddress, params, o))
		return {appCreateTx: appCreateTx, addOptionFns: addOptionFns};
	}

	// do everything in one function, using algosigner. This is for user convenience, if they trust us to sign things with algosigner 
	// async deployNewDecision()
	
	getDeployTxId(){
		return this.deployTxId; 
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

	// //TODO turn this into something more readable such as getResults 
	async readGlobalState(){
		await readGlobalState(this.client, this.creatorAddress, this.appID);
	}
}

export {QVoting}; 
