import {QVotingApprovalTeal, QVotingClearStateTeal} from "../../ContractCode";
import {Core} from "../Core";
import algosdk from "algosdk";

class QVoteAlgorand extends Core {

	constructor(millisecondsPerTxBlockAverage = 1000 * 60){
		super(millisecondsPerTxBlockAverage, QVotingApprovalTeal, QVotingClearStateTeal); 
	}

	getDeployParams(){
		const onComplete = algosdk.OnApplicationComplete.NoOpOC;	
		

	}


}
