
/*
 * Parameters of the contract for QVoting.
 */
export type QVoteParams = { 
	decisionName: string,
	votingStartTime: number, 
	votingEndTime: number, 
	assetID: number, 
	assetCoefficient: number,
	options: string[],
	creatorAddress: string
}

export type config = {
	token: any, 
	baseServer: any, 
	port: any
} 

export type QVoteState = { 
	decisionName: string,
	votingStartTime: number, 
	votingEndTime: number, 
	assetID: number, 
	assetCoefficient: number
	options: {title: string, value: number}[]
}
