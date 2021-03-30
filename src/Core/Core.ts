
class Core {
	protected compiledApprovalProgram : string; 
	protected compiledClearstateProgram : string; 
	protected millisecondsPerTxBlockAverage: number; 
	protected client: any; 
	protected approvalProgram : string; 
	protected clearstateProgram : string; 
// TODO should store the already compiled contracts, so we don't have to use the client every time 

	constructor(client: any, millisecondsPerTxBlockAverage: number, approvalProgram : string, clearstateProgram: string){
		this.millisecondsPerTxBlockAverage = millisecondsPerTxBlockAverage;
		this.approvalProgram = approvalProgram;
		this.clearstateProgram = clearstateProgram;
	}
	
	getFutureTxBlockNumber(blockNumber: number, millisecondsToAdd: number): string {
        return "" + blockNumber + Math.round((millisecondsToAdd / this.millisecondsPerTxBlockAverage));
    }

	async compileProgram(client, programSource) {
		let encoder = new TextEncoder();
		let programBytes = encoder.encode(programSource);
		let compileResponse = await client.compile(programBytes).do();
		let compiledBytes = new Uint8Array(Buffer.from(compileResponse.result, "base64"));
		return compiledBytes;
	}

	async waitForConfirmation(algodclient, txId) {
		let status = (await algodclient.status().do());
		let lastRound = status["last-round"];
	  	while (true) {
			const pendingInfo = await algodclient.pendingTransactionInformation(txId).do();
			if (pendingInfo["confirmed-round"] !== null && pendingInfo["confirmed-round"] > 0) {
			  console.log("Transaction " + txId + " confirmed in round " + pendingInfo["confirmed-round"]);
			  break;
			}
			lastRound++;
			await algodclient.statusAfterBlock(lastRound).do();
		}
    }
}

export {Core}; 
