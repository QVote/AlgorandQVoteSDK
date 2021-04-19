import * as algosdk from "algosdk";
import * as fs from "fs"
import * as assert from "assert"
import {ADD_OPTION_SYM, OPTION_SYM, NULL_OPTION_SYM} from "./symbols"


interface QVoteState {
	Name: string,
	Creator: string, 
	voting_start_time: number, 
	voting_end_time: number, 
	asset_id: number, 
	asset_coefficient: number
	// and then the options...
}

export function loadCompiledPrograms() : {approval: Uint8Array, clearState: Uint8Array}{
	const approvalRead = fs.readFileSync("../ContractCode/quadratic_voting_approval.teal.tok", {encoding: "base64"})
	const approvalProgram = new Uint8Array(Buffer.from(approvalRead, "base64"))
	const clearRead = fs.readFileSync("../ContractCode/quadratic_voting_clear_state.teal.tok", {encoding: "base64"});
	const clearProgram = new Uint8Array(Buffer.from(clearRead, "base64"))
	return {approval: approvalProgram, clearState: clearProgram}
}

function decodeBase64(s: string){
	return Buffer.from(s, 'base64').toString();
}

function decodeValue(v: {bytes: string, type: number, uint: number}){
	return {...v, bytes: Buffer.from(v.bytes, 'base64').toString()};
}

export async function readGlobalState(client: any, address: string, index: number){
    const accountInfoResponse = await client.accountInformation(address).do();
    for (let i = 0; i < accountInfoResponse['created-apps'].length; i++) { 
        if (accountInfoResponse['created-apps'][i].id == index) {
			const app = accountInfoResponse['created-apps'][i]
			const formattedState : QVoteState = app['params']['global-state'].reduce((acc, e) => {
				const key = decodeBase64(e.key)		
				return {...acc, [key]: key=="Name" ? decodeValue(e.value) : e.value}; 
			}, {})
			return formattedState; 
        }
    }
	console.log("QVote decision not found. Is the creator correct? Has the decision been deployed?")
}


export function resultsFromState(state: QVoteState){
	const results = Object.entries(state).reduce((acc, [key, value]) => {
		if (key.startsWith(OPTION_SYM)){
			acc[key.replace(OPTION_SYM, '')] = value.uint - 2**63
		}
		return acc; 
	}, {})

	return results; 
}

/* 
 * returns a function that takes an appID parameter, and when executed returns a tx that adds the options passed
 */
export function buildAddOptionTxFunc(creatorAddress: string, params: any, options : string[]){
	// const params = await this.client.getTransactionParams().do();
	const appArgs = [ADD_OPTION_SYM].concat(options).map(encodeString)
	return (appID) => algosdk.makeApplicationNoOpTxn(creatorAddress, params, appID, appArgs)
}

export const waitForConfirmation = async function (algodclient, txId) {
    let status = (await algodclient.status().do());
    let lastRound = status["last-round"];
      while (true) {
        const pendingInfo = await algodclient.pendingTransactionInformation(txId).do();
        if (pendingInfo["confirmed-round"] !== null && pendingInfo["confirmed-round"] > 0) {
          //Got the completed Transaction
          console.log("Transaction " + txId + " confirmed in round " + pendingInfo["confirmed-round"]);
          break;
        }
        lastRound++;
        await algodclient.statusAfterBlock(lastRound).do();
      }
};

export function encodeString(s: string) : Uint8Array {
	return new Uint8Array(Buffer.from(s));
}

export function encodeNumber(n: number){
	return new Uint8Array([n]);
}

export function pad(options: string[]) : string[] {
	assert(options.length <= 5)
	for (var i=0; options.length < 5; i++) {
		options.push(NULL_OPTION_SYM); 
	}
	return options;
}

export function groupOptions(options: string[]) : string[][] {
	var out = [];
	options.map((d, i) => {(i%5==0) && (out.push([])); out[out.length-1].push(d)})
	out[out.length-1] = pad(out[out.length-1])
	return out;
}


