#!/bin/bash
npm i && anchor build && anchor deploy --provider.wallet ./id.json --provider.cluster devnet && export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com && export ANCHOR_WALLET=./id.json && node initializeScript.js  --program 9iJw8EhxRL7A1BTZkJsiJqdtgpbFJYASH14hJwpB9R6  
