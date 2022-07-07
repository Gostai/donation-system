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
  const systemAccount = anchor.web3.Keypair.generate();
  const doneeAccount = anchor.web3.Keypair.generate();
  const collectionAccount = anchor.web3.Keypair.generate();
  const collection2Account = anchor.web3.Keypair.generate();
  const collection3Account = anchor.web3.Keypair.generate();
  const collection4Account = anchor.web3.Keypair.generate();
  const donorAccount = anchor.web3.Keypair.generate();
  const refererAccount = anchor.web3.Keypair.generate();
  const donor2Account = anchor.web3.Keypair.generate();
  
  //Owner and payer account
  let ownerAccount = null;
  const ownerAddress = "4LnHwNdQCBEV9YHQtjz5oPYjZiJu7WYsFx9RGvTZmxYT";  
  const seed = "uncover find gloom alley carpet shy ride attend reunion aerobic acoustic lady";  
  
  it("Initialize collection compain users", async () => {
      
    // Airdropping tokens to a donee.
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(doneeAccount.publicKey, solAmount),
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
  
  it("Program must throw error for initializition", async () => {
    //let [donatePlatform] = await find_donate_platform(authority);
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
    
    /*await program.rpc.initializeSystem(           
        donorAccount.publicKey,
	    reward_period,
	    reward_value,
      {
        accounts: {
          initializer: donorAccount.publicKey,          
          vaultSolAccount: vault_sol_account_pda,
          mint: mintToken.publicKey,  
          mintAuthority: mintAuthority.publicKey,
          vaultAccount: vault_account_pda,          
          systemProgram: anchor.web3.SystemProgram.programId,  
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemAccount: systemAccount.publicKey,
        },    
        signers: [
            donorAccount,
            mintAuthority,
            systemAccount,
        ],
      }
    );     */
    
    expect((async () =>
        await program.rpc.initializeSystem(           
        donorAccount.publicKey,
	    reward_period,
	    reward_value,
      {
        accounts: {
          initializer: donorAccount.publicKey,          
          vaultSolAccount: vault_sol_account_pda,
          mint: mintToken.publicKey,  
          mintAuthority: mintAuthority.publicKey,
          vaultAccount: vault_account_pda,          
          systemProgram: anchor.web3.SystemProgram.programId,  
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemAccount: systemAccount.publicKey,
        },    
        signers: [
            donorAccount,
            mintAuthority,
            systemAccount,
        ],
      }
    )     
    )()).to.be.rejectedWith(/The provided owner account is unknown/);
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
    
    //Initialize system account for donation system
    await program.rpc.initializeSystem(           
        ownerAccount.publicKey,
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
          systemAccount: systemAccount.publicKey,
        },    
        signers: [
            ownerAccount,
            mintAuthority,
            systemAccount,
        ],
      }
    );     
    
    //Account for assertion
    let _systemAccount = await program.account.systemAccount.fetch(
         systemAccount.publicKey
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
      
    //Initialize donation collection account 
    await program.rpc.initialize(          
          doneeAccount.publicKey,
          fee_value,
          val_for_fee_exempt,
          val_for_closing,	      
     {
        accounts: {
          initializer: doneeAccount.publicKey,
          systemAccount : systemAccount.publicKey,
          collectionAccount: collectionAccount.publicKey,          
        },
        instructions: [
          await program.account.collectionAccount.createInstruction(collectionAccount),
        ],
        signers: [
            collectionAccount, 
            doneeAccount, 
        ],
      }
    );    
    
    //Accounts for assertions
    let _collectionAccount = await program.account.collectionAccount.fetch(
         collectionAccount.publicKey
    ); 
    let _systemAccount = await program.account.systemAccount.fetch(
         systemAccount.publicKey
    );     
    let collections = _systemAccount.collections;
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
      
    //Accounts for assertions    
    let _vault_sol_before = await provider.connection.getBalance(vault_sol_account_pda);        
    let _user_before = await provider.connection.getBalance(donorAccount.publicKey);
    let _referer_before = await mintToken.getAccountInfo(refererTokenAccount);
    let _systemAccount = await program.account.systemAccount.fetch(
         systemAccount.publicKey
    );     
    let _commission_before = _systemAccount.commissionGathered.toNumber();
        
    //Make a donation to collection
    await program.rpc.donate(
          new anchor.BN(donateAmount),      
      {
        accounts: {          
          collectionAccount: collectionAccount.publicKey,
          systemAccount : systemAccount.publicKey,
          donor: donorAccount.publicKey,
          donorTokenAccount: donorTokenAccount,
          vaultSolAccount: vault_sol_account_pda,
          ownerAccount: ownerAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,  
          mint: mintToken.publicKey,  
          refererTokenAccount: refererTokenAccount,          
          vaultAuthority: vault_authority_pda,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [donorAccount],
      }
    );
     
    //Accounts for assertions
    let _user_after = await provider.connection.getBalance(donorAccount.publicKey);
    let _vault_sol = await provider.connection.getBalance(vault_sol_account_pda);
    _systemAccount = await program.account.systemAccount.fetch(
         systemAccount.publicKey
    );       
    let _referer_after = await mintToken.getAccountInfo(refererTokenAccount);
    //Check that donor CHRT account in top10
    assert.deepEqual(
      donorTokenAccount, _systemAccount.donors[0]["address"],
      "Adresses are different!"
    );
    //Check commission gathered from donor
    assert.ok(
        _systemAccount.commissionGathered.toNumber()==
            _commission_before + 10000000
    );   
    //Check donated lamports at the vault
    assert.ok(_vault_sol_before + donateAmount + 10000000 ==_vault_sol); 
    // Check referer recieved reward
    assert.ok(_referer_before.amount.toNumber() + 10100 == _referer_after.amount.toNumber());
  });
  
  it("Program must throw error for early reward", async () => {
      
      
    expect((async () =>
        await program.rpc.rewardDonor(            
            {
                accounts: {          
                systemAccount: systemAccount.publicKey,
                authority: ownerAccount.publicKey,
                mint: mintToken.publicKey,  
                vaultAuthority: vault_authority_pda,
                donorTokenAccount: donorTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,                  
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
    
    //Accounts for assertions  
    let _vault_sol_before = await provider.connection.getBalance(vault_sol_account_pda);  
    let _donee_before = await provider.connection.getBalance(doneeAccount.publicKey);
    let _collectionAccount = await program.account.collectionAccount.fetch(
         collectionAccount.publicKey
    );   
    let _donations_before=null;
    let _systemAccount = await program.account.systemAccount.fetch(
         systemAccount.publicKey
    );     
    let collections = _systemAccount.collections;
    for (let col of collections) {
        if (col.address.toString()==collectionAccount.publicKey) {
            _donations_before=col.donatedAmount.toNumber();  
            break;
        }            
    }    
     
    //Withdraw doantions do initializer
    await program.rpc.withdrawDonations(
          new anchor.BN(donateAmount),      
      {
        accounts: {          
          collectionAccount: collectionAccount.publicKey,
          authority: doneeAccount.publicKey,
          vaultSolAccount: vault_sol_account_pda,         
          systemProgram: anchor.web3.SystemProgram.programId, 
          systemAccount : systemAccount.publicKey,
        },
        signers: [doneeAccount],
      }
    );
    
    //Accounts for assertions
    let _vault_sol_after = await provider.connection.getBalance(vault_sol_account_pda);
    let _donee_after = await provider.connection.getBalance(doneeAccount.publicKey);
    
    let _donations_after=null;
    _systemAccount = await program.account.systemAccount.fetch(
         systemAccount.publicKey
    );     
    collections = _systemAccount.collections;
    for (let col of collections) {
        if (col.address.toString()==collectionAccount.publicKey) {
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
    
    //Accounts for assertion
    let _vault_sol_before = await provider.connection.getBalance(vault_sol_account_pda);
    let _owner_before = await provider.connection.getBalance(ownerAccount.publicKey);
    let _systemAccount = await program.account.systemAccount.fetch(
         systemAccount.publicKey
    ); 
    let _commission_before = _systemAccount.commissionGathered.toNumber();
       
    //Make commission withdrawal
    await program.rpc.withdrawCommission(
          new anchor.BN(commissionForDonate/2),      
      {
        accounts: {          
          systemAccount: systemAccount.publicKey,
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
         systemAccount.publicKey
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
      
	
	//Accounts for assertions
    let _systemAccount = await program.account.systemAccount.fetch(
         systemAccount.publicKey
    );   
    let donors = _systemAccount.donors;    
     
    //Reward donors from top10 one by one to make donorTokenAccount provideness in accounts array
    for (let don of donors) {
        //Account for assertion
        let _donor_token_before = await mintToken.getAccountInfo(don.address); 
        
        //Reward a donor
        await program.rpc.rewardDonor(            
            {
                accounts: {          
                systemAccount: systemAccount.publicKey,
                authority: ownerAccount.publicKey,
                mint: mintToken.publicKey,  
                vaultAuthority: vault_authority_pda,
                donorTokenAccount: don.address.toString(),
                tokenProgram: TOKEN_PROGRAM_ID,                  
                },
                signers: [ownerAccount],
            }
        );
        
        //Account for assertion
        let _donor_token_after = await mintToken.getAccountInfo(don.address); 
        //Logging rewarded accounts
        //console.log("Donor: "+don.address.toString()+" amount before "+
        //    _donor_token_before.amount+" and after " + _donor_token_after.amount
        //);
        
        //Check the donor recieved reward
        assert.ok(_donor_token_after.amount.toNumber() - _donor_token_before.amount.toNumber() == 1000*CHRT); 
    }
  });
  
  it("Contribute tokens to collection", async () => {
     
    //Account for assertions
    let _vault_before = await mintToken.getAccountInfo(vault_account_pda);
    
    //Make a CHRT transfer to collection 
    await program.rpc.contributeTokens(
          new anchor.BN(10*CHRT),      
      {
        accounts: {          
          collectionAccount: collectionAccount.publicKey,
          contributor: refererAccount.publicKey,
          vaultAccount: vault_account_pda,
          contributorTokenAccount: refererTokenAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemAccount: systemAccount.publicKey,
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
    
    //Make a CHRT transfer to collection for rent exemption
    await program.rpc.contributeTokens(
          new anchor.BN(2000*CHRT),      
      {
        accounts: {          
          collectionAccount: collectionAccount.publicKey,
          contributor: donorAccount.publicKey,
          vaultAccount: vault_account_pda,
          contributorTokenAccount: donorTokenAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemAccount: systemAccount.publicKey,
        },        
        signers: [donorAccount],
      }
    );    
    
    //Account for assertions
    let _collectionAccount = await program.account.collectionAccount.fetch(
         collectionAccount.publicKey
    );
    
    //Check confirmTransaction is more then value for fee exemption
    assert.ok(_collectionAccount.contributedAmount.toNumber()>2000*CHRT);
    
    //Accounts for assertions
    let _systemAccount = await program.account.systemAccount.fetch(
         systemAccount.publicKey
    );
    let _commission_before = _systemAccount.commissionGathered.toNumber();
    
    ////Account for assertions
    let _user_before = await provider.connection.getBalance(donor2Account.publicKey);    
    let _fee_before = await provider.connection.getBalance(ownerAccount.publicKey);
       
    //Make donation after fee examption
    await program.rpc.donate(
          new anchor.BN(donateAmount),      
      {
        accounts: {          
          collectionAccount: collectionAccount.publicKey,
          systemAccount : systemAccount.publicKey,
          donor: donor2Account.publicKey,
          donorTokenAccount: donor2TokenAccount,
          vaultSolAccount: vault_sol_account_pda,
          ownerAccount: ownerAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,  
          mint: mintToken.publicKey,  
          refererTokenAccount: refererTokenAccount,          
          vaultAuthority: vault_authority_pda,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [donor2Account],
      }
    );
     
    //Account for assertions
    let _user_after = await provider.connection.getBalance(donor2Account.publicKey);
    let _fee_after = await provider.connection.getBalance(ownerAccount.publicKey); 
    
    _systemAccount = await program.account.systemAccount.fetch(
         systemAccount.publicKey
    );
    
    //Check user send donation
    assert.ok(_user_before - donateAmount ==_user_after); 
    //Check commission is not changed
    assert.ok(_commission_before == _systemAccount.commissionGathered.toNumber());      
    
  });
   
   it("Reward donors", async () => {
      
	
	//Accounts for assertions
    let _systemAccount = await program.account.systemAccount.fetch(
         systemAccount.publicKey
    );   
    let donors = _systemAccount.donors;    
     
    //Reward donors from top10 one by one to make donorTokenAccount provideness in accounts array
    for (let don of donors) {
        //Account for assertion
        let _donor_token_before = await mintToken.getAccountInfo(don.address); 
        
        //Reward a donor
        await program.rpc.rewardDonor(            
            {
                accounts: {          
                systemAccount: systemAccount.publicKey,
                authority: ownerAccount.publicKey,
                mint: mintToken.publicKey,  
                vaultAuthority: vault_authority_pda,
                donorTokenAccount: don.address.toString(),
                tokenProgram: TOKEN_PROGRAM_ID,                  
                },
                signers: [ownerAccount],
            }
        );
        
        //Account for assertion
        let _donor_token_after = await mintToken.getAccountInfo(don.address); 
        
        //Logging rewarded accounts
        //console.log("Donor: "+don.address.toString()+" amount before "+
        //    _donor_token_before.amount+" and after " + _donor_token_after.amount
        //);
        
        //Check the donor recieved reward
        assert.ok(_donor_token_after.amount.toNumber() - _donor_token_before.amount.toNumber() == 1000*CHRT); 
    }
  });
  
   it("Contribute to close collection", async () => {
       
    
    //Initializing four collections with eqaul donates
    //Initialize one more collection
    await program.rpc.initialize(          
      doneeAccount.publicKey,	  
	  fee_value,
	  val_for_fee_exempt,
	  val_for_closing,
      {
        accounts: {
          initializer: doneeAccount.publicKey,          
          systemAccount: systemAccount.publicKey,
          collectionAccount: collection2Account.publicKey,
        },
        instructions: [
          await program.account.collectionAccount.createInstruction(collection2Account),
        ],
        signers: [
            collection2Account, 
            doneeAccount, 
        ],
      }
    );      
    
    //Make a donation to collection
    await program.rpc.donate(
          new anchor.BN(donateAmount),      
      {
        accounts: {          
          collectionAccount: collection2Account.publicKey,
          systemAccount : systemAccount.publicKey,
          donor: donorAccount.publicKey,
          donorTokenAccount: donorTokenAccount,
          vaultSolAccount: vault_sol_account_pda,
          ownerAccount: ownerAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,  
          mint: mintToken.publicKey,  
          refererTokenAccount: refererTokenAccount,          
          vaultAuthority: vault_authority_pda,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [donorAccount],
      }
    );
    
    //Initialize third collection
    await program.rpc.initialize(          
      doneeAccount.publicKey,	  
	  fee_value,
	  val_for_fee_exempt,
	  val_for_closing,
      {
        accounts: {
          initializer: doneeAccount.publicKey,          
          systemAccount: systemAccount.publicKey,
          collectionAccount: collection3Account.publicKey,
        },
        instructions: [
          await program.account.collectionAccount.createInstruction(collection3Account),
        ],
        signers: [
            collection3Account, 
            doneeAccount, 
        ],
      }
    );      
    
    //Make a donation to collection
    await program.rpc.donate(
          new anchor.BN(donateAmount),      
      {
        accounts: {          
          collectionAccount: collection3Account.publicKey,
          systemAccount : systemAccount.publicKey,
          donor: donor2Account.publicKey,
          donorTokenAccount: donor2TokenAccount,
          vaultSolAccount: vault_sol_account_pda,
          ownerAccount: ownerAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,  
          mint: mintToken.publicKey,  
          refererTokenAccount: refererTokenAccount,          
          vaultAuthority: vault_authority_pda,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [donor2Account],
      }
    );
    
    //Initialize fourth collection
    await program.rpc.initialize(          
      doneeAccount.publicKey,	  
	  fee_value,
	  val_for_fee_exempt,
	  val_for_closing,
      {
        accounts: {
          initializer: doneeAccount.publicKey,          
          systemAccount: systemAccount.publicKey,
          collectionAccount: collection4Account.publicKey,
        },
        instructions: [
          await program.account.collectionAccount.createInstruction(collection4Account),
        ],
        signers: [
            collection4Account, 
            doneeAccount, 
        ],
      }
    );      
    
    //Make a donation to collection
    await program.rpc.donate(
          new anchor.BN(donateAmount),      
      {
        accounts: {          
          collectionAccount: collection4Account.publicKey,
          systemAccount : systemAccount.publicKey,
          donor: donor2Account.publicKey,
          donorTokenAccount: donor2TokenAccount,
          vaultSolAccount: vault_sol_account_pda,
          ownerAccount: ownerAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,  
          mint: mintToken.publicKey,  
          refererTokenAccount: refererTokenAccount,          
          vaultAuthority: vault_authority_pda,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [donor2Account],
      }
    );
    
    
    //Accounts for assertions
    let _systemAccount = await program.account.systemAccount.fetch(
         systemAccount.publicKey
    );   
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
          collectionAccount: collection2Account.publicKey,
          contributor: donor2Account.publicKey,
          vaultAccount: vault_account_pda,
          contributorTokenAccount: donor2TokenAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemAccount: systemAccount.publicKey,
        },        
        signers: [donor2Account],
      }
    );   
   //Fetch collections vec 
   _systemAccount = await program.account.systemAccount.fetch(
         systemAccount.publicKey
    );     
    collections = _systemAccount.collections;
    for (let col of collections) {
        
        //Logging new amounts in collection after closing of one
        //console.log(col.address.toString(),col.donatedAmount.toNumber());
        
        if (col.address.toString()==collection2Account.publicKey) {
            //Check that collection is closed
            assert.ok(col.active==false);            
        }           
        
        if (col.address.toString()==collection3Account.publicKey) {
            //Check that collections except the last recieved rounded third part
            assert.ok(col.donatedAmount.toNumber()==133333334);            
        }   
        
        if (col.address.toString()==collection4Account.publicKey) {
            //Check that  the last collections recieved the rest of the closed collection balance
            assert.ok(col.donatedAmount.toNumber()==133333332);            
        }   
    }  
  });
   
   it("Program must throw error for unauthorized stop collection", async () => {
      
    expect((async () =>
        await program.rpc.stopCollection(         
      {
        accounts: {          
          collectionAccount: collectionAccount.publicKey,
          authority: donorAccount.publicKey,   
          systemAccount: systemAccount.publicKey,
        },
        signers: [donorAccount],
      }
    )
    )()).to.be.rejectedWith(/A has_one constraint was violated/);
  });
    
   it("Stop colletion", async () => {
    //Stops the collection, initiator can recieve donations at any time   
    //Accounts for assertions
    let _systemAccount = await program.account.systemAccount.fetch(
         systemAccount.publicKey
    );   
    let collections = _systemAccount.collections;      
       
    //Stop the collection
    await program.rpc.stopCollection(         
      {
        accounts: {          
          collectionAccount: collectionAccount.publicKey,
          authority: doneeAccount.publicKey,   
          systemAccount: systemAccount.publicKey,
        },
        signers: [doneeAccount],
      }
    );
    
    _systemAccount = await program.account.systemAccount.fetch(
         systemAccount.publicKey
    );     
    collections = _systemAccount.collections;
    for (let col of collections) {
        if (col.address.toString()==collectionAccount.publicKey) {
            assert.ok(col.active==false);
            break;
        }            
    }      
    
  });
   
});
