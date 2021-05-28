import type { Transaction } from "algosdk";

export type Address = Transaction["from"];

/*
 * Parameters of the contract for QVoting.
 */
export type QVoteParams = {
    decisionName: string;
    votingStartTime: number;
    votingEndTime: number;
    assetID: number;
    assetCoefficient: number;
    options: string[];
    creatorAddress: string;
};

export type config = {
    token: {
        "X-API-Key": string;
    };
    baseServer: string;
    port: string | number;
};

export type QVoteState = {
    decisionName: string;
    votingStartTime: number;
    votingEndTime: number;
    assetID: number;
    assetCoefficient: number;
    options: { title: string; value: number }[];
};
