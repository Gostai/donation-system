# Donation System  
Anchor based Solana donation system  

Code is tested in the localnet  

Test programm localy with :   
npm install  
anchor build  
anchor test  

To initialize programm in Devnet with script you must run :  

anchor build  
solana address -k ./target/deploy/donations-keypair.json  

Replace program id with recived program id in /programs/donations/src/lib.rs in  
declare_id!("9iJw8EhxRL7A1BTZkJsiJqdtgpbFJYASH14hJwpB9R6");  
and run anchor build again.  

Replace program id with recived in Anchor.toml.  

Replace program id with recived in initscript.sh  

Then run :  
yarn initialize.  

To test initialized program in Devnet replace  
const MINT_ACCOUNT = "4f75X6UD4k76tLMsxsKrSbmhQnpa8Lu8p6FaVU9L4NDu";  
with recieved in initialization mintToken account and run:  

node TestDonationSystem.js --program 9iJw8EhxRL7A1BTZkJsiJqdtgpbFJYASH14hJwpB9R6  

with recived program id.  

Some times program crashes with :  

/home/gorub/Documents/rustProjects/anchrPrjts/donation-system/TestDonationSystem.js:266  
    console.log(t.meta.logMessages);    
                  ^

TypeError: Cannot read property 'meta' of null  

because of slow confirmation in devnet.   

Just try it again. 

Some times program Fails due Solana limitations because of the too much number of collections in the program:
"consumed 200000 of 200000 compute units and exceeded maximum number of instructions allowed (200000)"
