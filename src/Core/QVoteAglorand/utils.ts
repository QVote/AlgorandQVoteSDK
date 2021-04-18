import * as algosdk from "algosdk";
import * as fs from "fs"
import * as assert from "assert"

const NULL_OPTION_SYM = "NULL_OPTION"  // NOTE: could store it already encoded 
const ADD_OPTION_SYM = "add_options"


export function loadCompiledPrograms() : {approval: Uint8Array, clearState: Uint8Array}{
	const approvalRead = fs.readFileSync("../ContractCode/quadratic_voting_approval.teal.tok", {encoding: "base64"})
	const approvalProgram = new Uint8Array(Buffer.from(approvalRead, "base64"))
	const clearRead = fs.readFileSync("../ContractCode/quadratic_voting_clear_state.teal.tok", {encoding: "base64"});
	const clearProgram = new Uint8Array(Buffer.from(clearRead, "base64"))
	return {approval: approvalProgram, clearState: clearProgram}
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


