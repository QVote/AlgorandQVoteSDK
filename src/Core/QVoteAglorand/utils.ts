import * as algosdk from "algosdk";
// import * as assert from "assert"
import {ADD_OPTION_SYM, OPTION_SYM, NULL_OPTION_SYM} from "./symbols"
import {qvApprovalProgram, qvClearProgram} from "../../ContractCode"


export type QVoteState = { 
	decisionName: string,
	votingStartTime: number, 
	votingEndTime: number, 
	assetID: number, 
	assetCoefficient: number
	options: {title: string, value: number}[]
}


// TODO maybe read this from ContractCode index file 
export function loadCompiledPrograms() : {approval: Uint8Array, clearState: Uint8Array}{
	/*const approvalRead = fs.readFileSync("../ContractCode/quadratic_voting_approval.teal.tok", {encoding: "base64"})
	const approvalProgram = new Uint8Array(Buffer.from(approvalRead, "base64"))
	const clearRead = fs.readFileSync("../ContractCode/quadratic_voting_clear_state.teal.tok", {encoding: "base64"});
	const clearProgram = new Uint8Array(Buffer.from(clearRead, "base64")) */
	return {approval: qvApprovalProgram, clearState: qvClearProgram}
}

function decodeBase64(s: string){
	return Buffer.from(s, 'base64').toString();
}

function decodeValue(v: {bytes: string, type: number, uint: number}){
	return {...v, bytes: Buffer.from(v.bytes, 'base64').toString()};
}

export async function readGlobalState(client: any, address: string, index: number) : Promise<QVoteState>{
    const accountInfoResponse = await client.accountInformation(address).do();
	const div = 100 		 // divide by this for 2 decimal place precision 
    for (let i = 0; i < accountInfoResponse['created-apps'].length; i++) { 
        if (accountInfoResponse['created-apps'][i].id == index) {
			const app = accountInfoResponse['created-apps'][i]
			const rawState = app['params']['global-state'].reduce((acc, {key, value}) => {
				const decodedKey = decodeBase64(key)
				const decodedValue = (decodedKey=="Name") ? decodeValue(value) : value
				acc[decodedKey] = decodedValue; 
				return acc;
			}, {})
			const formattedState : QVoteState = {
				options: Object.entries(rawState).filter(([key, value]) => key.startsWith(OPTION_SYM))
												 //@ts-ignore
												 .map(([key, value]) => ({title: key, value: (value.uint - 2**32) / div})),

				decisionName: rawState.Name.bytes,
				votingStartTime: rawState.voting_start_time.uint, 
				votingEndTime: rawState.voting_end_time.uint, 
				assetID: rawState.asset_id.uint,
				assetCoefficient: rawState.asset_coefficient.uint,
			}

			return formattedState;
		}
    }
	console.log("QVote decision not found. Is the creator correct? Has the decision been deployed?")
}


export async function readLocalStorage(client, userAddress, appID){
	let accountInfoResponse = await client.accountInformation(userAddress).do();
    for (let i = 0; i < accountInfoResponse['apps-local-state'].length; i++) { 
        if (accountInfoResponse['apps-local-state'][i].id == appID) {
			const state = accountInfoResponse['apps-local-state'][i][`key-value`];
			return state.map(({key, value}) => ({key: decodeBase64(key), value})); 	
		}
    }
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

// TODO make this work both little and big endian
export function intToByteArray(num: number, size: number): Uint8Array {
	let x = num;
	const res: number[] = [];

	while (x > 0) {
		res.push(x & 255);
		x = x >> 8;
	}
	
	const pad = size - res.length;
	for (let i = 0; i < pad; i++) {
    	// res.unshift(0);
		res.push(0);
	}

	return Uint8Array.from(res.reverse());
}

export function ByteArrayToIntBROKEN(array: Uint8Array){
	return Buffer.from(array).readUIntBE(0, 6);
}

export function pad(options: string[]) : string[] {
	// assert(options.length <= 5)
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


