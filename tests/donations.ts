import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { CustomWallet } from "../target/types/donations";
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import chai, { assert, expect } from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

describe("donations", () => {
  // Use a local provider.
  const provider = anchor.Provider.local();

  // Configure the client to use the local cluster.
  anchor.setProvider(provider);
  
  const program = anchor.workspace.Donations as Program<Donations>;
  
  //Initialize variables
  let mintToken = null as Token;
  let donorTokenAccount = null;
  let donor2TokenAccount = null;
  let doneeTokenAccount = null;
  let refererTokenAccount = null;
  let vault_sol_account_pda = null;
  let vault_sol_account_bump = null;
  let vault_account_pda = null;  
  let vault_account_bump = null;
  let vault_authority_pda = null;
  
  //decimals 3
  let CHRT = 1000;
  
  let SOL = anchor.web3.LAMPORTS_PER_SOL;
  
  ///Initialize donation parameters
  
  let reward_period = new anchor.BN(2);
  let reward_value = new anchor.BN(1000*CHRT);
  let top_platform = new anchor.BN(100);
  let top_collection = new anchor.BN(10);
  let max_collections = new anchor.BN(100);
  //In percents
  let fee_value = new anchor.BN(10);
  let val_for_fee_exempt = new anchor.BN(2000*CHRT);       
  let val_for_closing = new anchor.BN(3000*CHRT);
  
  //Amounts
  const solAmount =1*SOL;
  const tokenAmount = 1000*CHRT;
  const donateAmount = SOL/10;
  const commissionForDonate = 10000000;  
  const stopAmount = 14000;  
  
  //Keypairs for authorities
  const mintAuthority = anchor.web3.Keypair.generate(); 
  const doneeAccount = anchor.web3.Keypair.generate();
  const donee2Account = anchor.web3.Keypair.generate();
  const donee3Account = anchor.web3.Keypair.generate();
  const donee4Account = anchor.web3.Keypair.generate();
  const donorAccount = anchor.web3.Keypair.generate();
  const refererAccount = anchor.web3.Keypair.generate();
  const donor2Account = anchor.web3.Keypair.generate();
  
  
  //Owner and payer account
  let ownerAccount = null;
  const ownerAddress = "4LnHwNdQCBEV9YHQtjz5oPYjZiJu7WYsFx9RGvTZmxYT";  
  const seed = "uncover find gloom alley carpet shy ride attend reunion aerobic acoustic lady";  
  
  //Functions for  PDA finding
  async function find_donor_to_company_acc(donor: anchor.web3.PublicKey, collection: anchor.web3.PublicKey) {
    return await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("donated_by_donor_to_company"), donor.toBuffer(), collection.toBuffer()], program.programId
    );
  }
  
  async function find_systemAccount(authority: anchor.web3.PublicKey) {
    return await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("system_account"), authority.toBuffer()], program.programId
    );
  }
  
  async function find_top100Account(authority: anchor.web3.PublicKey) {
    return await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("top100_account"), authority.toBuffer()], program.programId
    );
  }
  
  async function find_CollectionAccount(authority: anchor.web3.PublicKey) {
    return await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("collection_account"), authority.toBuffer()], program.programId
    );
  }
  
  async function find_top10CollectionAccount(authority: anchor.web3.PublicKey) {
    return await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("top10_collection_account"), authority.toBuffer()], program.programId
    );
  }  
  
  it("Initialize collection system users", async () => {
      
    // Airdropping tokens to a donee.
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(doneeAccount.publicKey, solAmount),
      "processed"
    );
    // Airdropping tokens to a donee.
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(donee2Account.publicKey, solAmount),
      "processed"
    );
    // Airdropping tokens to a donee.
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(donee3Account.publicKey, solAmount),
      "processed"
    );
    // Airdropping tokens to a donee.
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(donee4Account.publicKey, solAmount),
      "processed"
    );    
    // Airdropping tokens to a donor
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(donorAccount.publicKey, solAmount),
      "processed"
    );    
    
    // Airdropping tokens to a referer
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(refererAccount.publicKey, solAmount),
      "processed"
    );    
    
    // Airdropping tokens to a donor2
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(donor2Account.publicKey, solAmount),
      "processed"
    );    
    
    //Create owner account
    let hex = Uint8Array.from(Buffer.from(seed));
    ownerAccount = anchor.web3.Keypair.fromSeed(hex.slice(0, 32));
    assert.ok(ownerAccount.publicKey.toString() == ownerAddress);

    // Airdropping tokens to a ownerAccount 
    await provider.connection.confirmTransaction(
    await provider.connection.requestAirdrop(ownerAccount.publicKey, solAmount),
      "processed"
    );
        
    //Create token mint for CHRT
    mintToken = await Token.createMint(
      provider.connection,
      ownerAccount,
      mintAuthority.publicKey,
      null,
      3,
      TOKEN_PROGRAM_ID
    );
    
    //Create CHRT accounts
    donorTokenAccount = 
        await mintToken.createAccount(donorAccount.publicKey);
     
    doneeTokenAccount = 
        await mintToken.createAccount(doneeAccount.publicKey);
        
    refererTokenAccount = 
        await mintToken.createAccount(refererAccount.publicKey);
        
    donor2TokenAccount = 
        await mintToken.createAccount(donor2Account.publicKey);
    
        
    //Mint tokens to CHRT  accounts
    await mintToken.mintTo(
      doneeTokenAccount,
      mintAuthority.publicKey,
      [mintAuthority],
      tokenAmount
    );
    
    await mintToken.mintTo(
      donorTokenAccount,
      mintAuthority.publicKey,
      [mintAuthority],
      tokenAmount*2,
    );
    
    await mintToken.mintTo(
      donor2TokenAccount,
      mintAuthority.publicKey,
      [mintAuthority],
      tokenAmount*3,
    );
     
    let _donorTokenAccount  = await mintToken.getAccountInfo(donorTokenAccount);     
    let _doneeTokenAccount  = await mintToken.getAccountInfo(doneeTokenAccount);    
    let _refererTokenAccount  = await mintToken.getAccountInfo(refererTokenAccount);    
    let _donor2TokenAccount  = await mintToken.getAccountInfo(donor2TokenAccount);
      
    assert.ok(_doneeTokenAccount.amount.toNumber() == tokenAmount);
    assert.ok(_donorTokenAccount.amount.toNumber() == 2000*CHRT);
    assert.ok(_refererTokenAccount.amount.toNumber() == 0);
    assert.ok(_donor2TokenAccount.amount.toNumber() == 3000*CHRT);
  });      
  
  it("Initialize donation system", async () => {
    
    //Find PDA for vaultAccount for SOL
    const [_vault_sol_account_pda, _vault_sol_account_bump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("sol-seed"))],
      program.programId
    );
    vault_sol_account_pda = _vault_sol_account_pda;
    vault_sol_account_bump = _vault_sol_account_bump;
    
    //Find PDA for vaultAccount for CHRT
    const [_vault_account_pda, _vault_account_bump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("token-seed"))],
      program.programId
    );
    vault_account_pda = _vault_account_pda;
    vault_account_bump = _vault_account_bump;
    
    //Find PDA for vault authority
    const [_vault_authority_pda, _vault_authority_bump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("collection"))],
      program.programId
    );
    vault_authority_pda = _vault_authority_pda;
    
    //Find PDA for accounts    
    let [systemAccount] = await find_systemAccount(ownerAccount.publicKey);        
    let [top100Account] = await find_top100Account(ownerAccount.publicKey);    
    
    //Initialize system account for donation system
    await program.rpc.initializeSystem(  
        max_collections,
        top_platform,
	    reward_period,
	    reward_value,
      {
        accounts: {
          initializer: ownerAccount.publicKey,          
          vaultSolAccount: vault_sol_account_pda,
          mint: mintToken.publicKey,  
          mintAuthority: mintAuthority.publicKey,
          vaultAccount: vault_account_pda,          
          systemProgram: anchor.web3.SystemProgram.programId,  
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemAccount: systemAccount,
          top100Account: top100Account,
        },    
        signers: [
            ownerAccount,
            mintAuthority,            
        ],
      }
    );     
    
    //Account for assertion
    let _systemAccount = await program.account.systemAccount.fetch(
         systemAccount
    );        
    let _vault = await mintToken.getAccountInfo(vault_account_pda);
    
    //Check ownership change
    assert.ok(_vault.owner.equals(vault_authority_pda));
    //Check initiazed values
    assert.ok(_vault.amount.toNumber()==0);        
    assert.ok(_systemAccount.rewardPeriod.toNumber()==2);        
    assert.ok(_systemAccount.rewardValue.toNumber()==reward_value);
  });  
     
  it("Initialize donation collection", async () => {  
    //Find PDA
    let [systemAccount] = await find_systemAccount(ownerAccount.publicKey);        
    let [collectionAccount] = await find_CollectionAccount(doneeAccount.publicKey);     
    let [top10CollectionAccount] = await find_top10CollectionAccount(collectionAccount);
      
    //Initialize donation collection account 
    await program.rpc.initialize( 
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
    
    //Accounts for assertions
    let _collectionAccount = await program.account.collectionAccount.fetch(
         collectionAccount
    ); 
    let _systemAccount = await program.account.systemAccount.fetch(
         systemAccount
    );     
    let collections = _systemAccount.collections;
    
    //Check collections mark vector
    for (let col of collections) {
        if (col.address.toString()==collectionAccount.publicKey) {
            assert.ok(col.active==true);
            break;
        }            
    }
    
    //Check initiazed values    
    assert.ok(_collectionAccount.feeValue.toNumber()==10);          
    assert.ok(_collectionAccount.valForFeeExempt.toNumber()==2000*CHRT);
    assert.ok(_collectionAccount.valForClosing.toNumber()==3000*CHRT);   
  });
  
  it("Donate to colletion", async () => {
    //Find PDA for accounts      
    let [systemAccount] = await find_systemAccount(ownerAccount.publicKey);        
    let [collectionAccount] = await find_CollectionAccount(doneeAccount.publicKey);    
    let [top100Account] = await find_top100Account(ownerAccount.publicKey);    
    let [top10CollectionAccount] = await find_top10CollectionAccount(collectionAccount);  
    
    //PDA for all donations information
    let [donatedByDonorToCompany] = await find_donor_to_company_acc(donorAccount.publicKey, collectionAccount);
      
    //Accounts for assertions    
    let _vault_sol_before = await provider.connection.getBalance(vault_sol_account_pda);        
    let _referer_before = await mintToken.getAccountInfo(refererTokenAccount);
    
    let _systemAccount = await program.account.systemAccount.fetch(
         systemAccount
    );     
    let _commission_before = _systemAccount.commissionGathered.toNumber();
    
    let _all_paltform_donations = _systemAccount.allPlatformDonations.toNumber();
    
    let _collectionAccount = await program.account.collectionAccount.fetch(
         collectionAccount
    ); 
    
    let _collected_in_company = _collectionAccount.amountCollectedInCompany.toNumber();
    
    //Make a donation to collection
    await program.rpc.donate(
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
          mint: mintToken.publicKey,  
          refererTokenAccount: refererTokenAccount,          
          vaultAuthority: vault_authority_pda,
          tokenProgram: TOKEN_PROGRAM_ID,
          donatedByDonorToCompany: donatedByDonorToCompany,
          top100Account: top100Account,
          top10CollectionAccount: top10CollectionAccount,
          
        },
        signers: [donorAccount],
      }
    );    
    //Account for asserts
    let _vault_sol = await provider.connection.getBalance(vault_sol_account_pda);    
    let _top100Account = await program.account.top100Account.fetch(
         top100Account
    );       
    let _referer_after = await mintToken.getAccountInfo(refererTokenAccount);
    
    //Check that donor CHRT account in top10
    assert.deepEqual(
      donorAccount.publicKey, _top100Account.donors[0]["address"],
      "Adresses are different!"
    );
    
    //Check for gathered commission counter
    _systemAccount = await program.account.systemAccount.fetch(
         systemAccount
    );        
    assert.ok(
        _systemAccount.commissionGathered.toNumber()==
            _commission_before + 10000000
    );   
    
    //Check donated lamports at the vault
    assert.ok(_vault_sol_before + donateAmount + 10000000 ==_vault_sol); 
    
    // Check referer recieved reward
    assert.ok(_referer_before.amount.toNumber() + 10100 == _referer_after.amount.toNumber());
    
    //Accounts for asserts
    let _all_paltform_donations_after = _systemAccount.allPlatformDonations.toNumber();
    
    _collectionAccount = await program.account.collectionAccount.fetch(
         collectionAccount
    ); 
    let _collected_in_company_after = _collectionAccount.amountCollectedInCompany.toNumber();
    
    //Check platform and company counters
    assert.ok(_all_paltform_donations + donateAmount == _all_paltform_donations_after);
    assert.ok(_collected_in_company + donateAmount == _collected_in_company_after);
  });
  
  it("Program must throw error for early reward", async () => {      
    let [top100Account] = await find_top100Account(ownerAccount.publicKey);  
    expect((async () =>
        await program.rpc.rewardDonor( 
            donorAccount.publicKey,
            {
                accounts: {          
                systemAccount: systemAccount.publicKey,
                authority: ownerAccount.publicKey,
                mint: mintToken.publicKey,  
                vaultAuthority: vault_authority_pda,
                donorTokenAccount: donorTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,    
                top100Account: top100Account,
                },
                signers: [ownerAccount],
            }
        )
    )()).to.be.rejectedWith(/The reward can not be done because of reward period still goes on/);
  });
  
  it("Program must throw error for unauthorized donations withdraw", async () => {
      
    expect((async () =>
        await program.rpc.withdrawDonations(
          new anchor.BN(donateAmount),      
      {
        accounts: {          
          collectionAccount: collectionAccount.publicKey,
          authority: donorAccount.publicKey,
          vaultSolAccount: vault_sol_account_pda,         
          systemProgram: anchor.web3.SystemProgram.programId, 
          systemAccount : systemAccount.publicKey,
        },
        signers: [donorAccount],
      }
    )
    )()).to.be.rejectedWith(/A has_one constraint was violated/);
  });
  
  it("Withdraw donations from colletion", async () => {
    //Find PDA accounts      
    let [systemAccount] = await find_systemAccount(ownerAccount.publicKey);        
    let [collectionAccount] = await find_CollectionAccount(doneeAccount.publicKey);
    
    //Accounts for assertions  
    let _vault_sol_before = await provider.connection.getBalance(vault_sol_account_pda);  
    let _donee_before = await provider.connection.getBalance(doneeAccount.publicKey);
    let _collectionAccount = await program.account.collectionAccount.fetch(
         collectionAccount
    );   
    let _donations_before=null;
    let _systemAccount = await program.account.systemAccount.fetch(
         systemAccount
    );         
    let collections = _systemAccount.collections;
    
    //Get collection donated amount before transaction
    for (let col of collections) {       
        if (col.address.toString()==collectionAccount) {
            _donations_before=col.donatedAmount.toNumber();              
            break;
        }            
    }    
    
    //Withdraw donations do initializer
    await program.rpc.withdrawDonations(
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
    
    //Accounts for assertions
    let _vault_sol_after = await provider.connection.getBalance(vault_sol_account_pda);
    let _donee_after = await provider.connection.getBalance(doneeAccount.publicKey);
    
    //Get collection donated amount after transaction
    let _donations_after=null;    
    _systemAccount = await program.account.systemAccount.fetch(
         systemAccount
    );     
    collections = _systemAccount.collections;
    for (let col of collections) {
        if (col.address.toString()==collectionAccount) {
            _donations_after=col.donatedAmount.toNumber();            
            break;            
        }            
    }    
    
    //Check that vault send withrawal
    assert.ok(_vault_sol_before - donateAmount ==_vault_sol_after); 
    //Check that initializer recieved withdrawal
    assert.ok(_donee_before + donateAmount ==_donee_after);    
    //Check that collection changed counters
    assert.ok(_donations_before - donateAmount ==_donations_after);   
  });  
  
  it("Program must throw error for unauthorized commission withdraw", async () => {
      
    expect((async () =>
        await program.rpc.withdrawCommission(
          new anchor.BN(commissionForDonate/2),      
      {
        accounts: {          
          systemAccount: systemAccount.publicKey,
          authority: donorAccount.publicKey,
          vaultSolAccount: vault_sol_account_pda,         
          systemProgram: anchor.web3.SystemProgram.programId, 
        },
        signers: [donorAccount],
      }
    )
    )()).to.be.rejectedWith(/A has_one constraint was violated/);
  });
  
  it("Withdraw commission by owner", async () => {
    //Find PDA accounts
    let [systemAccount] = await find_systemAccount(ownerAccount.publicKey);  
    
    //Accounts for assertion
    let _vault_sol_before = await provider.connection.getBalance(vault_sol_account_pda);
    let _owner_before = await provider.connection.getBalance(ownerAccount.publicKey);
    let _systemAccount = await program.account.systemAccount.fetch(
         systemAccount
    ); 
    let _commission_before = _systemAccount.commissionGathered.toNumber();
       
    //Make commission withdrawal
    await program.rpc.withdrawCommission(
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
    //Accounts for assertions
    let _vault_sol_after = await provider.connection.getBalance(vault_sol_account_pda);
    let _owner_after = await provider.connection.getBalance(ownerAccount.publicKey);    
    
    _systemAccount = await program.account.systemAccount.fetch(
         systemAccount
    );   
    
    //Check that vault send commission
    assert.ok(_vault_sol_before - commissionForDonate/2 ==_vault_sol_after); 
    //Check owner recieved commision
    assert.ok(_owner_before + commissionForDonate/2 ==_owner_after); 
    //Check that collection changed counters 
    assert.ok(_commission_before - commissionForDonate/2 ==_systemAccount.commissionGathered.toNumber());    
  });
  
  it("Program must throw error for unauthorized reward", async () => {      
      
    expect((async () =>
        await program.rpc.rewardDonor(            
            {
                accounts: {          
                systemAccount: systemAccount.publicKey,
                authority: donorAccount.publicKey,
                mint: mintToken.publicKey,  
                vaultAuthority: vault_authority_pda,
                donorTokenAccount: donorTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,                  
                },
                signers: [donorAccount],
            }
        )
    )()).to.be.rejectedWith(/A has_one constraint was violated/);
  });
  
  it("Reward donors", async () => {      
	
    //Find PDA accounts
    let [systemAccount] = await find_systemAccount(ownerAccount.publicKey); 
    let [top100Account] = await find_top100Account(ownerAccount.publicKey);     
    
    let _top100Account = await program.account.top100Account.fetch(top100Account);
    let donors = _top100Account.donors;
     
    //Reward donors from top10 one by one to make donorTokenAccount provideness in accounts array
    
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
            //console.log(donors);
            //console.log(top10NotRewarded);
        }
  
    }
    
    //Reward top 10
    for (let don of top10NotRewarded) {
        
        //Account for assertion
        let _donor_token_before = await mintToken.getAccountInfo(don.tokenAccount); 
                 
        //Reward a donor
        await program.rpc.rewardDonor(         
            don.address,
            {
                accounts: {          
                systemAccount: systemAccount,
                authority: ownerAccount.publicKey,
                mint: mintToken.publicKey,  
                vaultAuthority: vault_authority_pda,
                donorTokenAccount: don.tokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID, 
                top100Account: top100Account,
                },
                signers: [ownerAccount],
            }
        );
        
        //Account for assertion
        let _donor_token_after = await mintToken.getAccountInfo(don.tokenAccount); 
         
        //Check the donor recieved reward
        assert.ok(_donor_token_after.amount.toNumber() - _donor_token_before.amount.toNumber() == 1000*CHRT); 
    }
  });
  
  it("Contribute tokens to collection", async () => {
    //Find PDA accounts
    let [collectionAccount] = await find_CollectionAccount(doneeAccount.publicKey);
    let [systemAccount] = await find_systemAccount(ownerAccount.publicKey);  
     
    //Account for assertions
    let _vault_before = await mintToken.getAccountInfo(vault_account_pda);
    
    //Make a CHRT transfer to collection 
    await program.rpc.contributeTokens(
          new anchor.BN(10*CHRT),      
      {
        accounts: {          
          collectionAccount: collectionAccount,
          contributor: refererAccount.publicKey,
          vaultAccount: vault_account_pda,
          contributorTokenAccount: refererTokenAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemAccount: systemAccount,
        },        
        signers: [refererAccount],
      }
    );     
    
    //Account for assertions
    let _vault_after = await mintToken.getAccountInfo(vault_account_pda);
     
    // Check vault recieved contribution
    assert.ok(_vault_after.amount.toNumber()==10*CHRT + _vault_before.amount.toNumber());  
  });
  
  it("Contribute for fee exemption", async () => {
      
    //Find PDA accounts
    let [collectionAccount] = await find_CollectionAccount(doneeAccount.publicKey);  
    let [systemAccount] = await find_systemAccount(ownerAccount.publicKey);  
    
    //Make a CHRT transfer to collection for rent exemption
    await program.rpc.contributeTokens(
          new anchor.BN(2000*CHRT),      
      {
        accounts: {          
          collectionAccount: collectionAccount,
          contributor: donorAccount.publicKey,
          vaultAccount: vault_account_pda,
          contributorTokenAccount: donorTokenAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemAccount: systemAccount,
        },        
        signers: [donorAccount],
      }
    );    
    
    //Account for assertions
    let _collectionAccount = await program.account.collectionAccount.fetch(
         collectionAccount
    );
    
    //Check confirmTransaction is more then value for fee exemption
    assert.ok(_collectionAccount.contributedAmount.toNumber()>2000*CHRT);
    
    
    //Accounts for assertions
    let _systemAccount = await program.account.systemAccount.fetch(
         systemAccount
    );
    let _commission_before = _systemAccount.commissionGathered.toNumber();
    
    //Account for assertions
    let _vault_sol_before = await provider.connection.getBalance(vault_sol_account_pda);   
    
    //Find PDA accounts
    let [top100Account] = await find_top100Account(ownerAccount.publicKey);    
    let [top10CollectionAccount] = await find_top10CollectionAccount(collectionAccount);  
    
    //PDA for all donations information
    let [donatedByDonor2ToCompany] = await find_donor_to_company_acc(donor2Account.publicKey, collectionAccount);    
    
    //Make donation after fee examption
    await program.rpc.donate(
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
          mint: mintToken.publicKey,  
          refererTokenAccount: refererTokenAccount,          
          vaultAuthority: vault_authority_pda,
          tokenProgram: TOKEN_PROGRAM_ID,
          donatedByDonorToCompany: donatedByDonor2ToCompany,
          top100Account: top100Account,
          top10CollectionAccount: top10CollectionAccount,
        },
        signers: [donor2Account],
      }
    );
     
    //Account for assertions     
    let _vault_sol_after = await provider.connection.getBalance(vault_sol_account_pda);     
    
    _systemAccount = await program.account.systemAccount.fetch(
         systemAccount
    );
    
    //Check user send donation
    assert.ok( _vault_sol_after - _vault_sol_before ==donateAmount); 
    //Check commission is not changed
    assert.ok(_commission_before == _systemAccount.commissionGathered.toNumber());      
    
  });
   
   it("Reward donors", async () => {      
	//Find PDA accounts
    let [systemAccount] = await find_systemAccount(ownerAccount.publicKey); 
    let [top100Account] = await find_top100Account(ownerAccount.publicKey);
    
    //Helper to check rewarded field in top 100
    let rewardedAddress = null;       
	
    let _top100Account = await program.account.top100Account.fetch(top100Account);
    let donors = _top100Account.donors;
    
    //Reward donors from top10 one by one to make donorTokenAccount provideness in accounts array    
    
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
    
    for (let don of top10NotRewarded) {
        //Account for assertion
        let _donor_token_before = await mintToken.getAccountInfo(don.tokenAccount); 
                
        rewardedAddress= don.address;
        
        //Reward a donor
        await program.rpc.rewardDonor(         
            don.address,
            {
                accounts: {          
                systemAccount: systemAccount,
                authority: ownerAccount.publicKey,
                mint: mintToken.publicKey,  
                vaultAuthority: vault_authority_pda,
                donorTokenAccount: don.tokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID, 
                top100Account: top100Account,
                },
                signers: [ownerAccount],
            }
        );
        
        //Account for assertion
        let _donor_token_after = await mintToken.getAccountInfo(don.tokenAccount); 
         
        //Check the donor token account recieved reward
        assert.ok(_donor_token_after.amount.toNumber() - _donor_token_before.amount.toNumber() == 1000*CHRT);         
    }
    
    //Check that donorAccount is not in top10 because he was rewarded earlier
    assert.deepEqual(
      donor2Account.publicKey, rewardedAddress,
      "Adresses are different!"
    );    
  });
  
   it("Contribute to close collection", async () => {       
    
    //Initializing four collections with eqaul donates
       
    //Initialize one more collection with PDA       
    let [systemAccount] = await find_systemAccount(ownerAccount.publicKey);  
    let [top100Account] = await find_top100Account(ownerAccount.publicKey);  
    let [collection2Account] = await find_CollectionAccount(donee2Account.publicKey);
    let [top10CollectionAccount] = await find_top10CollectionAccount(collection2Account);
    
    await program.rpc.initialize(          
      top_collection,      
	  fee_value,
	  val_for_fee_exempt,
	  val_for_closing,
      {
        accounts: {
          initializer: donee2Account.publicKey,          
          systemAccount: systemAccount,
          collectionAccount: collection2Account,
          top10CollectionAccount: top10CollectionAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
        },        
        signers: [            
            donee2Account, 
        ],
      }
    );   
    
    //PDA for all donations information
    let [donatedByDonorToCompany] = await find_donor_to_company_acc(donorAccount.publicKey, collection2Account);
    
    //Make a donation to collection
    await program.rpc.donate(
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
          mint: mintToken.publicKey,  
          refererTokenAccount: refererTokenAccount,          
          vaultAuthority: vault_authority_pda,
          tokenProgram: TOKEN_PROGRAM_ID,
          donatedByDonorToCompany: donatedByDonorToCompany,
          top100Account: top100Account,
          top10CollectionAccount: top10CollectionAccount,
        },
        signers: [donorAccount],
      }
    );
    
    //Initialize third collection PDA
    let [collection3Account] = await find_CollectionAccount(donee3Account.publicKey);    
    let [top10Collection3Account] = await find_top10CollectionAccount(collection3Account);    
    
    //Initialize third collection
    await program.rpc.initialize(          
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
    
    //PDA for all donations information
    let [donatedByDonor2ToCompany] = await find_donor_to_company_acc(donor2Account.publicKey, collection3Account);
    
    //Make a donation to collection
    await program.rpc.donate(
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
          mint: mintToken.publicKey,  
          refererTokenAccount: refererTokenAccount,          
          vaultAuthority: vault_authority_pda,
          tokenProgram: TOKEN_PROGRAM_ID,
          donatedByDonorToCompany: donatedByDonor2ToCompany,
          top100Account: top100Account,
          top10CollectionAccount: top10Collection3Account,
        },
        signers: [donor2Account],
      }
    );
    //Find PDA accounts
    let [collection4Account] = await find_CollectionAccount(donee4Account.publicKey);
    let [top10Collection4Account] = await find_top10CollectionAccount(collection4Account);
    
    //Initialize fourth collection
    await program.rpc.initialize(    
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
    
    //PDA for all donations information
    let [donatedByDonor2ToCompany4] = await find_donor_to_company_acc(donor2Account.publicKey, collection4Account);
    
    //Make a donation to collection
    await program.rpc.donate(
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
          mint: mintToken.publicKey,  
          refererTokenAccount: refererTokenAccount,          
          vaultAuthority: vault_authority_pda,
          tokenProgram: TOKEN_PROGRAM_ID,
          donatedByDonorToCompany: donatedByDonor2ToCompany4,
          top100Account: top100Account,
          top10CollectionAccount: top10Collection4Account,
        },
        signers: [donor2Account],
      }
    );    
    
    //Accounts for assertions
    let _systemAccount = await program.account.systemAccount.fetch(
         systemAccount   );   
    let collections = _systemAccount.collections;  
    
    //Logging amounts in collections
    //for (let col of collections) {
    //    console.log(col.address.toString(),col.donatedAmount.toNumber());
    //}
    
    //Make a CHRT transfer to collection for close it
    await program.rpc.contributeTokens(
          new anchor.BN(3000*CHRT),      
      {
        accounts: {          
          collectionAccount: collection2Account,
          contributor: donor2Account.publicKey,
          vaultAccount: vault_account_pda,
          contributorTokenAccount: donor2TokenAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemAccount: systemAccount,
        },        
        signers: [donor2Account],
      }
    );   
    
   //Fetch collections vec 
   _systemAccount = await program.account.systemAccount.fetch(
         systemAccount
    );     
    collections = _systemAccount.collections;    
    
    //Check recieved amounts
    for (let col of collections) {
        
        //Logging new amounts in collection after closing of one
        //console.log(col.address.toString(), col.donatedAmount.toNumber());
        
        //Check that collection is closed
        if (col.address.toString()==collection2Account) {
            //Check that collection is closed
            assert.ok(col.active==false);            
        }           
        
        //Check amount in another
        if (col.address.toString()==collection3Account) {
            //Check that collections except the last recieved rounded third part
            assert.ok(col.donatedAmount.toNumber()==136666667);            
        }   
        
        //Check amount in another
        if (col.address.toString()==collection4Account) {
            //Check that  the last collections recieved the rest of the closed collection balance
            assert.ok(col.donatedAmount.toNumber()==136666666);            
        }   
    } 
  });
   
   it("Program must throw error for unauthorized stop collection", async () => {
    //Find PDA accounts
    let [collectionAccount] = await find_CollectionAccount(doneeAccount.publicKey);  
    let [systemAccount] = await find_systemAccount(ownerAccount.publicKey);    
    
    expect((async () =>
        await program.rpc.stopCollection(         
      {
        accounts: {          
          collectionAccount: collectionAccount,
          authority: donorAccount.publicKey,   
          systemAccount: systemAccount,
        },
        signers: [donorAccount],
      }
    )
    )()).to.be.rejectedWith(/A has_one constraint was violated/);
  });
    
   it("Stop colletion", async () => {
       
    //Stops the collection, initiator can recieve donations at any time  

    //Find PDA accounts
    let [collectionAccount] = await find_CollectionAccount(doneeAccount.publicKey);  
    let [systemAccount] = await find_systemAccount(ownerAccount.publicKey);    
  
    //Accounts for assertions
    let _systemAccount = await program.account.systemAccount.fetch(
         systemAccount
    );   
    let collections = _systemAccount.collections;      
       
    //Stop the collection
    await program.rpc.stopCollection(         
      {
        accounts: {          
          collectionAccount: collectionAccount,
          authority: doneeAccount.publicKey,   
          systemAccount: systemAccount,
        },
        signers: [doneeAccount],
      }
    );
    
    //Accounts for asserts
    _systemAccount = await program.account.systemAccount.fetch(
         systemAccount
    );     
    collections = _systemAccount.collections;
    
    //Check the collection is closed
    for (let col of collections) {
        if (col.address.toString()==collectionAccount) {
            assert.ok(col.active==false);
            break;
        }            
    }      
    
  });
   
});
