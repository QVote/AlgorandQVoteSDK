export const QVotingApprovalTeal = `
#pragma version 2
txn ApplicationID
int 0
==
bnz l0
txn OnCompletion
int DeleteApplication
==
bnz l1
txn OnCompletion
int UpdateApplication
==
bnz l2
txn OnCompletion
int OptIn
==
bnz l3
txna ApplicationArgs 0
byte "vote"
==
bnz l4
txna ApplicationArgs 0
byte "add_options"
==
bnz l5
err
l0:
byte "Creator"
txn Sender
app_global_put
byte "Name"
txna ApplicationArgs 0
app_global_put
byte "asset_id"
txna ApplicationArgs 6
btoi
app_global_put
byte "asset_coefficient"
txna ApplicationArgs 7
btoi
app_global_put
byte "voting_start_time"
txna ApplicationArgs 8
btoi
app_global_put
byte "voting_end_time"
txna ApplicationArgs 9
btoi
app_global_put
txna ApplicationArgs 1
byte "NULL_OPTION"
!=
bnz l7
int 1
return
b l8
l7:
byte "option_"
txna ApplicationArgs 1
concat
int 9223372036854775808
app_global_put
l8:
txna ApplicationArgs 2
byte "NULL_OPTION"
!=
bnz l9
int 1
return
b l10
l9:
byte "option_"
txna ApplicationArgs 2
concat
int 9223372036854775808
app_global_put
l10:
txna ApplicationArgs 3
byte "NULL_OPTION"
!=
bnz l11
int 1
return
b l12
l11:
byte "option_"
txna ApplicationArgs 3
concat
int 9223372036854775808
app_global_put
l12:
txna ApplicationArgs 4
byte "NULL_OPTION"
!=
bnz l13
int 1
return
b l14
l13:
byte "option_"
txna ApplicationArgs 4
concat
int 9223372036854775808
app_global_put
l14:
txna ApplicationArgs 5
byte "NULL_OPTION"
!=
bnz l15
int 1
return
b l16
l15:
byte "option_"
txna ApplicationArgs 5
concat
int 9223372036854775808
app_global_put
l16:
int 1
return
int 1
return
b l6
l1:
int 0
return
b l6
l2:
int 0
return
b l6
l3:
global LatestTimestamp
byte "voting_start_time"
app_global_get
>
bz l17
int 0
return
l17:
int 0
byte "asset_id"
app_global_get
asset_holding_get AssetBalance
store 0
store 1
load 0
bnz l18
int 0
return
b l19
l18:
int 0
byte "QVoteDecisionCredits"
load 1
byte "asset_coefficient"
app_global_get
*
app_local_put
int 1
return
l19:
b l6
l4:
global LatestTimestamp
byte "voting_start_time"
app_global_get
<
bz l20
int 0
return
l20:
global LatestTimestamp
byte "voting_end_time"
app_global_get
>
bz l21
int 0
return
l21:
int 0
byte "option_"
txna ApplicationArgs 1
concat
app_global_get_ex
store 2
store 3
load 2
bnz l22
int 0
return
b l27
l22:
int 0
byte "QVoteDecisionCredits"
int 0
byte "QVoteDecisionCredits"
app_local_get
txna ApplicationArgs 2
btoi
txna ApplicationArgs 2
btoi
*
-
app_local_put
int 0
byte "QVoteDecisionCredits"
app_local_get
int 0
>=
bnz l23
int 0
return
b l26
l23:
txna ApplicationArgs 3
byte "-"
==
bnz l24
byte "option_"
txna ApplicationArgs 1
concat
load 3
txna ApplicationArgs 2
btoi
+
app_global_put
b l25
l24:
byte "option_"
txna ApplicationArgs 1
concat
load 3
txna ApplicationArgs 2
btoi
-
app_global_put
l25:
l26:
int 1
return
l27:
b l6
l5:
txna ApplicationArgs 1
byte "NULL_OPTION"
!=
bnz l28
int 1
return
b l29
l28:
byte "option_"
txna ApplicationArgs 1
concat
int 9223372036854775808
app_global_put
l29:
txna ApplicationArgs 2
byte "NULL_OPTION"
!=
bnz l30
int 1
return
b l31
l30:
byte "option_"
txna ApplicationArgs 2
concat
int 9223372036854775808
app_global_put
l31:
txna ApplicationArgs 3
byte "NULL_OPTION"
!=
bnz l32
int 1
return
b l33
l32:
byte "option_"
txna ApplicationArgs 3
concat
int 9223372036854775808
app_global_put
l33:
txna ApplicationArgs 4
byte "NULL_OPTION"
!=
bnz l34
int 1
return
b l35
l34:
byte "option_"
txna ApplicationArgs 4
concat
int 9223372036854775808
app_global_put
l35:
txna ApplicationArgs 5
byte "NULL_OPTION"
!=
bnz l36
int 1
return
b l37
l36:
byte "option_"
txna ApplicationArgs 5
concat
int 9223372036854775808
app_global_put
l37:
int 1
return
l6: `

export const QVotingClearStateTeal = `
#pragma version 2
int 1
return`

export const QueueApprovalTeal = `
#pragma version 2
txn ApplicationID
int 0
==
bnz l0
txn OnCompletion
int DeleteApplication
==
bnz l1
txn OnCompletion
int UpdateApplication
==
bnz l2
txn OnCompletion
int OptIn
==
bnz l3
txna ApplicationArgs 0
byte "push"
==
bnz l4
err
l0:
byte "index"
int 0
app_global_put
txna ApplicationArgs 0
btoi
int 62
>
bz l6
int 0
return
l6:
byte "size"
txna ApplicationArgs 0
btoi
app_global_put
int 1
return
b l5
l1:
int 0
return
b l5
l2:
int 0
return
b l5
l3:
int 1
return
b l5
l4:
byte "index"
app_global_get
itob
txna ApplicationArgs 1
app_global_put
byte "size"
app_global_get
byte "index"
app_global_get
int 1
+
>
bnz l7
byte "index"
int 0
app_global_put
b l8
l7:
byte "index"
byte "index"
app_global_get
int 1
+
app_global_put
l8:
int 1
return
l5: `

export const QueueClearStateTeal = `
#pragma version 2
int 1
return`
