// Parse arguments
// --program - [Required] The account address for your deployed program.
const anchor = require("@project-serum/anchor");
const token = require("@solana/spl-token");

const args = require('minimist')(process.argv.slice(2));

// Initialize Anchor and provider
const provider = anchor.Provider.env();

// Configure the cluster.
anchor.setProvider(provider);

//decimals 3
let CHRT = 1000;
let SOL = anchor.web3.LAMPORTS_PER_SOL;

//Amounts
const solAmount =1*SOL;
const tokenAmount = 1000*CHRT;
const donateAmount = SOL/10;
const commissionForDonate = 10000000;  
//const stopAmount = 14000;  

//Values for collection property
let top_collection = new anchor.BN(10);
let fee_value = new anchor.BN(10);
let val_for_fee_exempt = new anchor.BN(200*CHRT);       
let val_for_closing = new anchor.BN(300*CHRT);

///Mint account initialized
const MINT_ACCOUNT = "4f75X6UD4k76tLMsxsKrSbmhQnpa8Lu8p6FaVU9L4NDu";
const mintAccount = new anchor.web3.PublicKey(MINT_ACCOUNT);

///ATA generating accounts
const SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID =
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const splATAProgramId = new anchor.web3.PublicKey(SPL_ASSOCIATED_TOKEN_ACCOUNT_PROGRAM_ID);
const tokenProgramId = new anchor.web3.PublicKey(token.TOKEN_PROGRAM_ID);

async function find_systemAccount(authority, programId) {
    return await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("system_account"), authority.toBuffer()], programId
    );
  }
  
async function find_top100Account(authority, programId) {
    return await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("top100_account"), authority.toBuffer()], programId
    );
  }

async function find_CollectionAccount(authority, programId) {
    return await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("collection_account"), authority.toBuffer()], programId
    );
  }

async function find_top10CollectionAccount(authority, programId) {
    return await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("top10_collection_account"), authority.toBuffer()], programId
    );
  }  

async function find_donor_to_company_acc(donor, collection, programId) {
    return await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("donated_by_donor_to_company"), donor.toBuffer(), collection.toBuffer()], programId
    );
  }

//Functions for finding PDA
async function FindOrCreateATA(solanaPubkey, mintAccount, provider, ownerAccount) {
    //console.log("Solana Pubkey for finding ATA is", solanaPubkey.toString());    
    //console.log("mintAccount", mintAccount.toString());   

    const associatedAddress = await token.Token.getAssociatedTokenAddress(
      splATAProgramId,
      tokenProgramId,
      mintAccount,
      solanaPubkey
    );
    //console.log("ATA publicKey: ", associatedAddress.toString());

    const doesAccountExist = await provider.connection.getAccountInfo(associatedAddress);
    //console.log("doesAccountExist publicKey: ", doesAccountExist);

    ///checking ATA

    if (!doesAccountExist) {
      console.log("we did not found  ATA, creating...");      
      const transaction = new anchor.web3.Transaction().add(
        token.Token.createAssociatedTokenAccountInstruction(
          splATAProgramId,
          tokenProgramId,
          mintAccount,
          associatedAddress,
          solanaPubkey, //owner
          provider.wallet.publicKey //payer
        )
      );

      transaction.feePayer = provider.wallet.publicKey;

      //console.log("Getting recent blockhash");
      transaction.recentBlockhash = (
        await provider.connection.getRecentBlockhash()
      ).blockhash;

      let signed = await provider.wallet.signTransaction(transaction);      
      
      let signature = await provider.connection.sendRawTransaction(signed.serialize());

      let confirmed = await provider.connection.confirmTransaction(signature);
    } else {
      console.log("ATA already exists..");
    }
    const aTAAccount = await provider.connection.getAccountInfo(associatedAddress);
    //console.log("ATA : ", aTAAccount);
    const userATAAccount = new anchor.web3.PublicKey(associatedAddress);

    const aTAbalance = await provider.connection.getTokenAccountBalance(userATAAccount);
    //console.log("USER ATA balance : ", aTAbalance.value.uiAmountString);
    
    return associatedAddress.toString();
  }


async function main() {
  // Read the generated IDL.  
  const idl = JSON.parse(
    require("fs").readFileSync("./target/idl/donations.json", "utf8")
  );
  
  // Address of the deployed program.
  const programId = new anchor.web3.PublicKey(args['program']);

  // Generate the program client from IDL.
  const program = new anchor.Program(idl, programId);  
  
  //Read Keypair for system owner
  kp = JSON.parse(require("fs").readFileSync("./id.json", "utf8")); 
  
  //Create owner account
  arr = Object.values(kp);
  secret = new Uint8Array(arr);
  ownerAccount = anchor.web3.Keypair.fromSecretKey(secret);   
  console.log("owner pk",ownerAccount.publicKey.toString());
  
  //Create donee account and airdrop
  const doneeAccount = anchor.web3.Keypair.generate();
  console.log("doneeAccount",doneeAccount.publicKey.toString());   
  let tx = await provider.connection.requestAirdrop(doneeAccount.publicKey, solAmount);
  
  //Waite for confirmation
  pause=10
  console.log('waiting for '+pause+' sec...');
  await new Promise(resolve => setTimeout(resolve, pause*1000));    
  
  //Find PDA for accounts    
  let [systemAccount] = await find_systemAccount(provider.wallet.publicKey, programId);
  let [collectionAccount] = await find_CollectionAccount(doneeAccount.publicKey, programId);      
  let [top10CollectionAccount] = await find_top10CollectionAccount(collectionAccount, programId);

  console.log("Initializing collection by " ,doneeAccount.publicKey.toString());
  //Initialize donation collection account 
  let tx1 = await program.rpc.initialize( 
          top_collection,
          fee_value,
          val_for_fee_exempt,
          val_for_closing,	      
     {
        accounts: {
          initializer: doneeAccount.publicKey,
          systemAccount : systemAccount,
          collectionAccount: collectionAccount,         
          top10CollectionAccount: top10CollectionAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
        },        
        signers: [            
            doneeAccount, 
        ],
      }
  );    

  console.log("Fetching transaction logs...");
  let t = await provider.connection.getConfirmedTransaction(tx1, "confirmed");
  console.log(t.meta.logMessages);     

  /// Donating to collection
  
  //Find PDA for accounts            
  let [top100Account] = await find_top100Account(ownerAccount.publicKey, programId);   
  
  //Create donor and referer account
  const donorAccount = anchor.web3.Keypair.generate();  
  console.log('requestAirdrop donorAccount');
  //Airdrop accounts
  tx = await provider.connection.requestAirdrop(donorAccount.publicKey, solAmount);
  
  const refererAccount = anchor.web3.Keypair.generate();  
  
  console.log('waiting for '+pause+' sec...');
  await new Promise(resolve => setTimeout(resolve, pause*1000));
  
  console.log("Get token account for " , donorAccount.publicKey.toString());
  //Get the token accont of donor, if it does not exist, create it
  donorTokenAccount = await FindOrCreateATA(donorAccount.publicKey, mintAccount, provider, ownerAccount);
  
  console.log("Get token account for " , refererAccount.publicKey.toString());
  //Get the token accont of referer, if it does not exist, create it
  refererTokenAccount = await FindOrCreateATA(refererAccount.publicKey, mintAccount, provider,ownerAccount);

  //PDA for all donations information
  let [donatedByDonorToCompany] = await find_donor_to_company_acc(donorAccount.publicKey, collectionAccount, programId);
   
  //Find PDA for vaultAccount for SOL
  const [_vault_sol_account_pda, _vault_sol_account_bump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("sol-seed"))],
      program.programId
  );
  vault_sol_account_pda = _vault_sol_account_pda;
 
  //Find PDA for vault authority
  const [_vault_authority_pda, _vault_authority_bump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("collection"))],
      program.programId
  );
  vault_authority_pda = _vault_authority_pda;
    
  //Creating helper accounts for collection distribution
  const donee3Account = anchor.web3.Keypair.generate();
  console.log('waiting for '+pause+' sec...');
  await new Promise(resolve => setTimeout(resolve, pause*1000)); 
  console.log('requestAirdrop for helper donee3Account' );
  await provider.connection.requestAirdrop(donee3Account.publicKey, solAmount);   
  
  console.log("Donate by " , donorAccount.publicKey.toString(), " to collection ", collectionAccount.toString() );
  
  //Make a donation to collection
  let tx2 = await program.rpc.donate(
          new anchor.BN(donateAmount),      
      {
        accounts: {          
          collectionAccount: collectionAccount,
          systemAccount : systemAccount,
          donor: donorAccount.publicKey,
          donorTokenAccount: donorTokenAccount,
          vaultSolAccount: vault_sol_account_pda,
          ownerAccount: ownerAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,  
          mint: mintAccount,  
          refererTokenAccount: refererTokenAccount,          
          vaultAuthority: vault_authority_pda,
          tokenProgram: token.TOKEN_PROGRAM_ID,
          donatedByDonorToCompany: donatedByDonorToCompany,
          top100Account: top100Account,
          top10CollectionAccount: top10CollectionAccount,
          
        },
        signers: [donorAccount],
      }
   );    

  console.log("Fetching transaction logs...");
  t = await provider.connection.getConfirmedTransaction(tx2, "confirmed");
  console.log(t.meta.logMessages);    
    

  console.log("Withdraw donations by " , doneeAccount.publicKey.toString());
  ///Withdraw donations do initializer    
  let tx3 = await program.rpc.withdrawDonations(
          new anchor.BN(donateAmount),      
      {
        accounts: {          
          collectionAccount: collectionAccount,
          authority: doneeAccount.publicKey,
          vaultSolAccount: vault_sol_account_pda,         
          systemProgram: anchor.web3.SystemProgram.programId, 
          systemAccount : systemAccount,
        },
        signers: [doneeAccount],
      }
  );

  console.log("Fetching transaction logs...");
  t = await provider.connection.getConfirmedTransaction(tx3, "confirmed");
  console.log(t.meta.logMessages);
    
  pause = 15
    
  const donee2Account = anchor.web3.Keypair.generate();
  console.log('waiting for '+pause+' sec...');
  await new Promise(resolve => setTimeout(resolve, pause*1000));
  
  console.log('requestAirdrop donee2Account' );
  await provider.connection.requestAirdrop(donee2Account.publicKey, solAmount);
    
  console.log("Withdraw commision by " , ownerAccount.publicKey.toString());   
  ///Make commission withdrawal  
  tx4 = await program.rpc.withdrawCommission(
          new anchor.BN(commissionForDonate/2),      
      {
        accounts: {          
          systemAccount: systemAccount,
          authority: ownerAccount.publicKey,
          vaultSolAccount: vault_sol_account_pda,         
          systemProgram: anchor.web3.SystemProgram.programId, 
        },
        signers: [ownerAccount],
      }
  );

  console.log("Fetching transaction logs...");
  t = await provider.connection.getConfirmedTransaction(tx4, "confirmed");
  console.log(t.meta.logMessages);    
    
  let _top100Account = await program.account.top100Account.fetch(top100Account);
  let donors = _top100Account.donors;

  //Make top 10 array
  var top10NotRewarded=[];
  let max=0;
  let max_i=_top100Account.max_donors;
    
  for (let t = 0; t < 10; t++) {
        let i=0;    
        for(let don of donors) {
            if(!don.rewarded){
                if(don.amount>max) {
                max = don.amount;
                max_i=i;
                }
            }
            i++;        
        }
        let [donor] = donors.splice(max_i,1)
        if (donor) {
            top10NotRewarded.push(donor);           
        }  
  }
    
    //Reward top 10
  for (let don of top10NotRewarded) {
        console.log('waiting for '+pause+' sec...');
        await new Promise(resolve => setTimeout(resolve, pause*1000));    
        
        console.log("Rewarding donor " , don.address.toString()); 
  
        //Reward a donor
        tx4 = await program.rpc.rewardDonor(         
            don.address,
            {
                accounts: {          
                systemAccount: systemAccount,
                authority: ownerAccount.publicKey,
                mint: mintAccount,  
                vaultAuthority: vault_authority_pda,
                donorTokenAccount: don.tokenAccount,
                tokenProgram: token.TOKEN_PROGRAM_ID, 
                top100Account: top100Account,
                },
                signers: [ownerAccount],
            }
        );
        
        console.log("Fetching transaction logs...");
        t = await provider.connection.getConfirmedTransaction(tx4, "confirmed");
        console.log(t.meta.logMessages);   
  }

///Contribute tokens to collection

//Find PDA accounts
    
//Find PDA for vaultAccount for CHRT
  const [_vault_account_pda, _vault_account_bump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("token-seed"))],
      program.programId
  );
  vault_account_pda = _vault_account_pda;
  vault_account_bump = _vault_account_bump;
    
    
  console.log("Contribut tokens to  " , collectionAccount.toString()); 
  //Make a CHRT transfer to collection         
  let tx5 = await program.rpc.contributeTokens(
          new anchor.BN(10*CHRT),      
      {
        accounts: {          
          collectionAccount: collectionAccount,
          contributor: refererAccount.publicKey,
          vaultAccount: vault_account_pda,
          contributorTokenAccount: refererTokenAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: token.TOKEN_PROGRAM_ID,
          systemAccount: systemAccount,
        },        
        signers: [refererAccount],
      }
  ); 

  console.log("Fetching transaction logs...");
  t = await provider.connection.getConfirmedTransaction(tx5, "confirmed");
  console.log(t.meta.logMessages);    
    
  ///Contribute for fee exemption

  //Find PDA accounts
    
    
  console.log("Contribut tokens for fee examption  " , collectionAccount.toString()); 
  
  //Make a CHRT transfer to collection for rent exemption
  let tx6 = await program.rpc.contributeTokens(
          new anchor.BN(200*CHRT),      
      {
        accounts: {          
          collectionAccount: collectionAccount,
          contributor: donorAccount.publicKey,
          vaultAccount: vault_account_pda,
          contributorTokenAccount: donorTokenAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: token.TOKEN_PROGRAM_ID,
          systemAccount: systemAccount,
        },        
        signers: [donorAccount],
      }
  );    

  console.log("Fetching transaction logs...");
  t = await provider.connection.getConfirmedTransaction(tx6, "confirmed");
  console.log(t.meta.logMessages);
    
          
  //Helper account for collections distribution
  const donor2Account = anchor.web3.Keypair.generate();      
  let [donatedByDonor2ToCompany] = await find_donor_to_company_acc(donor2Account.publicKey, collectionAccount, programId);   
  
    
  //Airdrop accounts
  console.log('requestAirdrop donor2Account' );
  tx = await provider.connection.requestAirdrop(donor2Account.publicKey, solAmount);
  console.log('waiting for '+pause+' sec...');  
  await new Promise(resolve => setTimeout(resolve, pause*1000));
  
  console.log("Find ATA for   " , donor2Account.publicKey.toString());   
  //Get the token accont of referer, if it does not exist, create it
  donor2TokenAccount = await FindOrCreateATA(donor2Account.publicKey, mintAccount, provider,ownerAccount);
    
  console.log("Donate with fee exemption to  " , collectionAccount.toString());   
  //Make donation after fee examption
   let tx7 =await program.rpc.donate(
          new anchor.BN(donateAmount),      
      {
      accounts: {          
          collectionAccount: collectionAccount,
          systemAccount : systemAccount,
          donor: donor2Account.publicKey,
          donorTokenAccount: donor2TokenAccount,
          vaultSolAccount: vault_sol_account_pda,
          ownerAccount: ownerAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,  
          mint: mintAccount,  
          refererTokenAccount: refererTokenAccount,          
          vaultAuthority: vault_authority_pda,
          tokenProgram: token.TOKEN_PROGRAM_ID,
          donatedByDonorToCompany: donatedByDonor2ToCompany,
          top100Account: top100Account,
          top10CollectionAccount: top10CollectionAccount,
        },
        signers: [donor2Account],
      }
  );

  console.log("Fetching transaction logs...");
  t = await provider.connection.getConfirmedTransaction(tx7, "confirmed");
  console.log(t.meta.logMessages);
    

  ///Contribute to close collection  

  //Initializing four collections with eqaul donates   
  
  //Helper account for collections distribution
  const donee4Account = anchor.web3.Keypair.generate();  
  console.log('waiting for '+pause+' sec...');
  await new Promise(resolve => setTimeout(resolve, pause*1000));  
  console.log('requestAirdrop donee4Account' );
  await provider.connection.requestAirdrop(donee4Account.publicKey, solAmount); 
    
  let [collection2Account] = await find_CollectionAccount(donee2Account.publicKey, programId);
  let [top10Collection2Account] = await find_top10CollectionAccount(collection2Account, programId);
    
  console.log("Initialize second collection  " , collection2Account.toString()); 
  
  let tx8 = await program.rpc.initialize(          
      top_collection,      
	  fee_value,
	  val_for_fee_exempt,
	  val_for_closing,
      {
        accounts: {
          initializer: donee2Account.publicKey,          
          systemAccount: systemAccount,
          collectionAccount: collection2Account,
          top10CollectionAccount: top10Collection2Account,
          systemProgram: anchor.web3.SystemProgram.programId,
        },        
        signers: [            
            donee2Account, 
        ],
      }
  );   
  console.log("Fetching transaction logs...");
  t = await provider.connection.getConfirmedTransaction(tx8, "confirmed");
  console.log(t.meta.logMessages);
    
    //PDA for all donations information
  let [donatedByDonorToCompany2] = await find_donor_to_company_acc(donorAccount.publicKey, collection2Account, programId);
    
  console.log("Donate to second collection by " , donorAccount.publicKey.toString()); 
    //Make a donation to collection
  tx8 = await program.rpc.donate(
          new anchor.BN(donateAmount),      
      {
        accounts: {          
          collectionAccount: collection2Account,
          systemAccount : systemAccount,
          donor: donorAccount.publicKey,
          donorTokenAccount: donorTokenAccount,
          vaultSolAccount: vault_sol_account_pda,
          ownerAccount: ownerAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,  
          mint: mintAccount,  
          refererTokenAccount: refererTokenAccount,          
          vaultAuthority: vault_authority_pda,
          tokenProgram: token.TOKEN_PROGRAM_ID,
          donatedByDonorToCompany: donatedByDonorToCompany2,
          top100Account: top100Account,
          top10CollectionAccount: top10Collection2Account,
        },
        signers: [donorAccount],
      }
  );
  console.log("Fetching transaction logs...");
  t = await provider.connection.getConfirmedTransaction(tx8, "confirmed");
  console.log(t.meta.logMessages);
    
    
  //Initialize third collection PDA
  let [collection3Account] = await find_CollectionAccount(donee3Account.publicKey, programId);    
  let [top10Collection3Account] = await find_top10CollectionAccount(collection3Account, programId);    
    
  console.log("Initialize third collection  " , collection3Account.toString()); 
  //Initialize third collection
  tx8 = await program.rpc.initialize(          
      top_collection, 
	  fee_value,
	  val_for_fee_exempt,
	  val_for_closing,
      {
        accounts: {
          initializer: donee3Account.publicKey,          
          systemAccount: systemAccount,
          collectionAccount: collection3Account,
          top10CollectionAccount: top10Collection3Account,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        
        signers: [            
            donee3Account, 
        ],
      }
  );    

  console.log("Fetching transaction logs...");
  t = await provider.connection.getConfirmedTransaction(tx8, "confirmed");
  console.log(t.meta.logMessages);
      
    
  //PDA for all donations information
  let [donatedByDonor2ToCompany3] = await find_donor_to_company_acc(donor2Account.publicKey, collection3Account, programId);
    
  console.log("Donate to third collection by " , donor2Account.publicKey.toString()); 
    //Make a donation to collection
  tx8 = await program.rpc.donate(
          new anchor.BN(donateAmount),      
      {
        accounts: {          
          collectionAccount: collection3Account,
          systemAccount : systemAccount,
          donor: donor2Account.publicKey,
          donorTokenAccount: donor2TokenAccount,
          vaultSolAccount: vault_sol_account_pda,
          ownerAccount: ownerAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,  
          mint: mintAccount,  
          refererTokenAccount: refererTokenAccount,          
          vaultAuthority: vault_authority_pda,
          tokenProgram: token.TOKEN_PROGRAM_ID,
          donatedByDonorToCompany: donatedByDonor2ToCompany3,
          top100Account: top100Account,
          top10CollectionAccount: top10Collection3Account,
        },
        signers: [donor2Account],
      }
  );

  console.log("Fetching transaction logs...");
  t = await provider.connection.getConfirmedTransaction(tx8, "confirmed");
  console.log(t.meta.logMessages);
    
  //Find PDA accounts
  let [collection4Account] = await find_CollectionAccount(donee4Account.publicKey, programId);
  let [top10Collection4Account] = await find_top10CollectionAccount(collection4Account, programId);
    
  console.log("Initialize fourth collection  " , collection4Account.toString()); 
    //Initialize fourth collection
  tx8 = await program.rpc.initialize(    
	  top_collection,
	  fee_value,
	  val_for_fee_exempt,
	  val_for_closing,
      {
        accounts: {
          initializer: donee4Account.publicKey,          
          systemAccount: systemAccount,
          collectionAccount: collection4Account,
          top10CollectionAccount: top10Collection4Account,
          systemProgram: anchor.web3.SystemProgram.programId,
        },        
        signers: [            
            donee4Account, 
        ],
      }
  );   
  console.log("Fetching transaction logs...");
  t = await provider.connection.getConfirmedTransaction(tx8, "confirmed");
  console.log(t.meta.logMessages);
       
    
  //PDA for all donations information
  let [donatedByDonor2ToCompany4] = await find_donor_to_company_acc(donor2Account.publicKey, collection4Account, programId);
    
  console.log("Donate to fourth collection by " , donor2Account.publicKey.toString()); 
    //Make a donation to collection
  tx8 = await program.rpc.donate(
          new anchor.BN(donateAmount),      
      {
        accounts: {          
          collectionAccount: collection4Account,
          systemAccount : systemAccount,
          donor: donor2Account.publicKey,
          donorTokenAccount: donor2TokenAccount,
          vaultSolAccount: vault_sol_account_pda,
          ownerAccount: ownerAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,  
          mint: mintAccount,  
          refererTokenAccount: refererTokenAccount,          
          vaultAuthority: vault_authority_pda,
          tokenProgram: token.TOKEN_PROGRAM_ID,
          donatedByDonorToCompany: donatedByDonor2ToCompany4,
          top100Account: top100Account,
          top10CollectionAccount: top10Collection4Account,
        },
        signers: [donor2Account],
      }
  ); 

  console.log("Fetching transaction logs...");
  t = await provider.connection.getConfirmedTransaction(tx8, "confirmed");
  console.log(t.meta.logMessages);
       
  //Fetch collections vec 
  _systemAccount = await program.account.systemAccount.fetch(
         systemAccount
  );     
  collections = _systemAccount.collections;  
  //Logging amounts in collections
  for (let col of collections) {
        console.log("Collection "+col.address.toString()+" have "+col.donatedAmount.toNumber()+" amount");
  }
    
  //Fails because if the number of collections is big the program
  //consumed 200000 of 200000 compute units and 
  //exceeded maximum number of instructions allowed (200000)
    
  console.log("Make a CHRT transfer to close collection  " , collection2Account.toString()); 
  //Make a CHRT transfer to collection for close it
  let tx9 = await program.rpc.contributeTokens(
          new anchor.BN(300*CHRT),      
      {
        accounts: {          
          collectionAccount: collection2Account,
          contributor: donorAccount.publicKey,
          vaultAccount: vault_account_pda,
          contributorTokenAccount: donorTokenAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: token.TOKEN_PROGRAM_ID,
          systemAccount: systemAccount,
        },        
        signers: [donorAccount],
      }
  );   
  console.log("Fetching transaction logs...");
  t = await provider.connection.getConfirmedTransaction(tx9, "confirmed");
  console.log(t.meta.logMessages);
    
    
  //Fetch collections vec 
  _systemAccount = await program.account.systemAccount.fetch(
         systemAccount
  );     
  collections = _systemAccount.collections;    
    
  console.log("After distribition...");
  //Check recieved amounts
  for (let col of collections) {        
        //Logging new amounts in collection after closing of one
        
        console.log("Collection "+col.address.toString()+" have "+col.donatedAmount.toNumber()+" amount");   
  }       

  ///Stop collection

  //Stops the collection, initiator can recieve donations at any time  

  console.log("Stop collection " , collectionAccount.toString());    
  //Stop the collection
  let tx10 = await program.rpc.stopCollection(         
      {
        accounts: {          
          collectionAccount: collectionAccount,
          authority: doneeAccount.publicKey,   
          systemAccount: systemAccount,
        },
        signers: [doneeAccount],
      }
  );
  console.log("Fetching transaction logs...");
  t = await provider.connection.getConfirmedTransaction(tx10, "confirmed");
  console.log(t.meta.logMessages);    
    
}

console.log("Running client...");
main().then(() => console.log("Success"));
