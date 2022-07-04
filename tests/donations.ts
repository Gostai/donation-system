import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { CustomWallet } from "../target/types/donations";
import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { assert } from "chai";

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
  let donatorTokenAccount = null;
  let refererTokenAccount = null;
  let vault_sol_account_pda = null;
  let vault_sol_account_bump = null;
  let vault_account_pda = null;  
  let vault_account_bump = null;
  let vault_authority_pda = null;
  
  //decimal 3
  let CHRT = 1000;
  
  let SOL = anchor.web3.LAMPORTS_PER_SOL;
  
  ///Initialize donation parameters
  //2 minutes
  let reward_period = new anchor.BN(20);
  let reward_value = new anchor.BN(1000*CHRT);
  //TODO: fee value hardcode in percent
  let fee_value = new anchor.BN(10);
  let val_for_fee_exempt = new anchor.BN(2000*CHRT);       
  let val_for_closing = new anchor.BN(3000*CHRT);
  
  //lamportspersol
  const solAmount =1*SOL;
  const tokenAmount = 1000*CHRT;
  const donateAmount = SOL/10;
  //const contributeAmount = 1000*CHRT;
  const stopAmount = 14000;
  //const allowAmount = 100;
  
  const mintAuthority = anchor.web3.Keypair.generate();

  //TODO: move mintAuthority to vault_authority
  const donatorAccount = anchor.web3.Keypair.generate();
  const collectionAccount = anchor.web3.Keypair.generate();
  const collection2Account = anchor.web3.Keypair.generate();
  const donorAccount = anchor.web3.Keypair.generate();
  const refererAccount = anchor.web3.Keypair.generate();
  const donor2Account = anchor.web3.Keypair.generate();
  
  let ownerAccount = null;
  const ownerAddress = "4LnHwNdQCBEV9YHQtjz5oPYjZiJu7WYsFx9RGvTZmxYT";  
  const seed = "uncover find gloom alley carpet shy ride attend reunion aerobic acoustic lady";  
  
  it("Initialize collection compain users", async () => {
      
    // Airdropping tokens to a donator.
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(donatorAccount.publicKey, solAmount),
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

    // Airdropping tokens to a feeAccount 
    await provider.connection.confirmTransaction(
    await provider.connection.requestAirdrop(ownerAccount.publicKey, solAmount),
      "processed"
    );
        
    //Create token mint
    mintToken = await Token.createMint(
      provider.connection,
      ownerAccount,
      mintAuthority.publicKey,
      null,
      3,
      TOKEN_PROGRAM_ID
    );
    
    //Create token accounts
    donorTokenAccount = 
        await mintToken.createAccount(donorAccount.publicKey);
     
    donatorTokenAccount = 
        await mintToken.createAccount(donatorAccount.publicKey);
        
    refererTokenAccount = 
        await mintToken.createAccount(refererAccount.publicKey);
        
    donor2TokenAccount = 
        await mintToken.createAccount(donor2Account.publicKey);
    
        //TODO: why
    //Mint tokens to donator account
    await mintToken.mintTo(
      donatorTokenAccount,
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
     
    let _donatorTokenAccount  = await mintToken.getAccountInfo(donatorTokenAccount);
    
    let _refererTokenAccount  = await mintToken.getAccountInfo(refererTokenAccount);
    
    let _donor2TokenAccount  = await mintToken.getAccountInfo(donor2TokenAccount);
    
     
    assert.ok(_donatorTokenAccount.amount.toNumber() == tokenAmount);
    assert.ok(_donorTokenAccount.amount.toNumber() == 2000*CHRT);
    assert.ok(_refererTokenAccount.amount.toNumber() == 0);
    assert.ok(_donor2TokenAccount.amount.toNumber() == 3000*CHRT);
    
    
     
  });     
  
  it("Initialize system", async () => {
    
    //Find PDA for vaultAccount with SOL
    const [_vault_sol_account_pda, _vault_sol_account_bump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from(anchor.utils.bytes.utf8.encode("sol-seed"))],
      program.programId
    );
    vault_sol_account_pda = _vault_sol_account_pda;
    vault_sol_account_bump = _vault_sol_account_bump;
    
    //Find PDA for vaultAccount  with CHRT
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
    
    //Initialize wallet account with state
    let tx = await program.rpc.initializeSystem(        
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
        },    
        signers: [
            ownerAccount,
            mintAuthority,
        ],
      }
    );     
  
    let _vault = await mintToken.getAccountInfo(vault_account_pda);
    
    //TODO: check mint authority change
    //let _mint = await mintToken.getAccountInfo(vault_account_pda);    
         
    
    assert.ok(_vault.owner.equals(vault_authority_pda));
    assert.ok(_vault.amount.toNumber()==0);    
   
   
  });
  
     
  it("Initialize collection", async () => {
    
    
    //Initialize wallet account with state
    let tx = await program.rpc.initialize(          
          donatorAccount.publicKey,
	  reward_period,
	  reward_value,
	  fee_value,
	  val_for_fee_exempt,
	  val_for_closing,
	      
      {
        accounts: {
          initializer: donatorAccount.publicKey,
          ownerAccount: ownerAccount.publicKey,
          collectionAccount: collectionAccount.publicKey,
          
        },
        instructions: [
          await program.account.collectionAccount.createInstruction(collectionAccount),
        ],
        
        
        signers: [
            collectionAccount, 
            donatorAccount, /*is it needed*/
            //mintAuthority,
        ],
      }
    );     
  
   
     
    let _collectionAccount = await program.account.collectionAccount.fetch(
         collectionAccount.publicKey
    );     
    
  
    assert.ok(_collectionAccount.active==true);
    assert.ok(_collectionAccount.rewardPeriod.toNumber()==20);
    //assert.ok(_collectionAccount.last_reward_time.toNumber()< now());
    console.log("slot saved : ", _collectionAccount.lastRewardTime.toNumber());
    assert.ok(_collectionAccount.rewardValue.toNumber()==reward_value);
    assert.ok(_collectionAccount.feeValue.toNumber()==10);          
    assert.ok(_collectionAccount.valForFeeExempt.toNumber()==2000*CHRT);
    assert.ok(_collectionAccount.valForClosing.toNumber()==3000*CHRT);
   
  });
  
  it("Donate to colletion", async () => {
      
    //let transferAmount = 2000;
    
    let _vault_sol_before = await provider.connection.getBalance(vault_sol_account_pda);
    //console.log("before",_vault_sol_before);
    
    let _user_before = await provider.connection.getBalance(donorAccount.publicKey);
    
    let _fee_before = await provider.connection.getBalance(ownerAccount.publicKey);
    
    let _referer_before = await mintToken.getAccountInfo(refererTokenAccount);
    //console.log("referer_token_account",refererTokenAccount);
    //console.log("donateAmount",donateAmount);
    
    //Make a transfer to wallets vault for SOL
    await program.rpc.donate(
          new anchor.BN(donateAmount),      
      {
        accounts: {          
          collectionAccount: collectionAccount.publicKey,
          donor: donorAccount.publicKey,
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
     
    let _user_after = await provider.connection.getBalance(donorAccount.publicKey);
  
    let _vault_sol = await provider.connection.getBalance(vault_sol_account_pda);
    //console.log("after",_vault_sol);
    
    
    let _fee_after = await provider.connection.getBalance(ownerAccount.publicKey);    
    
    //console.log("_vault_sol_before + donateAmount - 10000000  ==_vault_sol ");
    assert.ok(_vault_sol_before + donateAmount ==_vault_sol); 
    assert.ok(_fee_after - _fee_before==10000000);      
    
    let _referer_after = await mintToken.getAccountInfo(refererTokenAccount);
     
    // Check new vault amount
    assert.ok(_referer_before.amount.toNumber() + 10100 == _referer_after.amount.toNumber());
     
    
    
  });
  
  it("Withdraw from colletion", async () => {
      
    
    let _vault_sol_before = await provider.connection.getBalance(vault_sol_account_pda);
    //console.log("before",_vault_sol_before);
    
     
    let _donator_before = await provider.connection.getBalance(donatorAccount.publicKey);
    
     
    //Make a transfer to wallets vault for SOL
    await program.rpc.withdrawDonations(
          new anchor.BN(donateAmount),      
      {
        accounts: {          
          collectionAccount: collectionAccount.publicKey,
          authority: donatorAccount.publicKey,
          vaultSolAccount: vault_sol_account_pda,         
          systemProgram: anchor.web3.SystemProgram.programId, 
        },
        signers: [donatorAccount],
      }
    );
     
    
    let _vault_sol_after = await provider.connection.getBalance(vault_sol_account_pda);
    //console.log("after",_vault_sol);
    
    
    let _donator_after = await provider.connection.getBalance(donatorAccount.publicKey);    
    
    //console.log("_vault_sol_before + donateAmount - 10000000  ==_vault_sol ");
    assert.ok(_vault_sol_before - donateAmount ==_vault_sol_after); 
    assert.ok(_donator_before + donateAmount==_donator_after);      
    
    
  });
  
  
  
  it("Contribute tokens to collection", async () => {
      
    let _vault_before = await mintToken.getAccountInfo(vault_account_pda);
    
    //Make a transfer to collection vault for tokens
    await program.rpc.contributeTokens(
          new anchor.BN(10000),      
      {
        accounts: {          
          collectionAccount: collectionAccount.publicKey,
          contributor: refererAccount.publicKey,
          vaultAccount: vault_account_pda,
          contributorTokenAccount: refererTokenAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        },        
        signers: [refererAccount],
      }
    );     
  
    let _vault_after = await mintToken.getAccountInfo(vault_account_pda);
     
    // Check new vault amount
    assert.ok(_vault_after.amount.toNumber()==10*CHRT + _vault_before.amount.toNumber());     
    
    
  });
  
  it("Contribute for fee exemption", async () => {
      
    //let _vault_before = await mintToken.getAccountInfo(vault_account_pda);
    
    //Make a transfer to collection vault for tokens
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
        },        
        signers: [donorAccount],
      }
    );     
  
    //let _vault_after = await mintToken.getAccountInfo(vault_account_pda);
    
    let _collectionAccount = await program.account.collectionAccount.fetch(
         collectionAccount.publicKey
    );
    
    assert.ok(_collectionAccount.contributedAmount.toNumber()>2000*CHRT);
    
    
    let _user_before = await provider.connection.getBalance(donorAccount.publicKey);
    
    let _fee_before = await provider.connection.getBalance(ownerAccount.publicKey);
    
    //let _referer_before = await mintToken.getAccountInfo(refererTokenAccount);
    //console.log("referer_token_account",refererTokenAccount);
    //console.log("donateAmount",donateAmount);
    
    //Make a transfer to wallets vault for SOL
    await program.rpc.donate(
          new anchor.BN(donateAmount),      
      {
        accounts: {          
          collectionAccount: collectionAccount.publicKey,
          donor: donorAccount.publicKey,
          vaultSolAccount: vault_sol_account_pda,
          ownerAccount: ownerAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,  
          mint: mintToken.publicKey,  
          //TODO: referer optionality
          refererTokenAccount: refererTokenAccount,          
          vaultAuthority: vault_authority_pda,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        signers: [donorAccount],
      }
    );
     
    let _user_after = await provider.connection.getBalance(donorAccount.publicKey);
  
    //let _vault_sol = await provider.connection.getBalance(vault_sol_account_pda);
    //console.log("after",_vault_sol);
    
    
    let _fee_after = await provider.connection.getBalance(ownerAccount.publicKey);    
    
    //console.log("_vault_sol_before + donateAmount - 10000000  ==_vault_sol ");
    assert.ok(_user_before - donateAmount ==_user_after); 
    assert.ok(_fee_after == _fee_before);      
    
  });
  
   it("Contribute to close collection", async () => {
      
    
       
    let tx = await program.rpc.initialize(          
      donatorAccount.publicKey,
	  reward_period,
	  reward_value,
	  fee_value,
	  val_for_fee_exempt,
	  val_for_closing,
      {
        accounts: {
          initializer: donatorAccount.publicKey,
          ownerAccount: ownerAccount.publicKey,
          collectionAccount: collection2Account.publicKey,
        },
        instructions: [
          await program.account.collectionAccount.createInstruction(collection2Account),
        ],
        signers: [
            collection2Account, 
            donatorAccount, /*is it needed*/
            //mintAuthority,
        ],
      }
    );     
  
    
    //Make a transfer to collection vault for tokens
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
        },        
        signers: [donor2Account],
      }
    );   
    
    let _collectionAccount = await program.account.collectionAccount.fetch(
         collection2Account.publicKey
    );
    
    assert.ok(_collectionAccount.active==false);
  
   
       
    
  });
  
  
  
  
   it("Stop colletion", async () => {
    
    //Stop the collection
    await program.rpc.stopCollection(         
      {
        accounts: {          
          collectionAccount: collectionAccount.publicKey,
          authority: donatorAccount.publicKey,          
        },
        signers: [donatorAccount],
      }
    );
     
    let _collectionAccount = await program.account.collectionAccount.fetch(
         collectionAccount.publicKey
    );
    
    assert.ok(_collectionAccount.active==false);
    
  });
   
   
   
  
  /*
   it("Set wallet fee", async () => {      
    let newFee = 15;
    
    //Setting new fee in walletAccount in percents
    let tx = await program.rpc.setFee(          
           new anchor.BN(newFee),      
      {
        accounts: {
          authority: payer.publicKey,
          walletAccount: walletAccount.publicKey,          
        },       
        signers: [payer],
      }
    );
     
    let _walletAccount = await program.account.walletAccount.fetch(
         walletAccount.publicKey
    );
    
    assert.ok(_walletAccount.feeValue.toNumber()==15);
    
  });
  
   
   it("Transfer SOL to wallet", async () => {
      
    let transferAmount = 2000;
    
    let _vault_sol_before = await provider.connection.getBalance(vault_sol_account_pda);
    
    let _user_before = await provider.connection.getBalance(payer.publicKey);
    
    let _fee_before = await provider.connection.getBalance(feeAccount.publicKey);
    
    //Make a transfer to wallets vault for SOL
    await program.rpc.transferSolFrom(
          new anchor.BN(transferAmount),      
      {
        accounts: {          
          walletAccount: walletAccount.publicKey,
          user: payer.publicKey,
          vaultSolAccount: vault_sol_account_pda,
          feeAccount: feeAccount.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,  
        },
        signers: [payer],
      }
    );
     
    let _user_after = await provider.connection.getBalance(payer.publicKey);
  
    let _vault_sol = await provider.connection.getBalance(vault_sol_account_pda);
    
    let _fee_after = await provider.connection.getBalance(feeAccount.publicKey);    
    
    assert.ok(_vault_sol_before + transferAmount- 300==_vault_sol); 
    assert.ok(_fee_after - _fee_before==300);      
    
  });
   
   
  it("Transfer SOL from wallet to recepient", async () => {
      
    let transferAmount = 2000;
    
    let _vault_sol_before = await provider.connection.getBalance(vault_sol_account_pda);
    
    let _recepient_before = await provider.connection.getBalance(recepientAccount.publicKey);
    
    let _fee_before = await provider.connection.getBalance(feeAccount.publicKey);    
     
    //Make a transfer from wallets vault 
    await program.rpc.transferSolTo(
          new anchor.BN(transferAmount),      
      {
        accounts: {          
          walletAccount: walletAccount.publicKey,
          authority: payer.publicKey,
          recepient: recepientAccount.publicKey,
          vaultSolAccount: vault_sol_account_pda,
          feeAccount: feeAccount.publicKey,          
          systemProgram: anchor.web3.SystemProgram.programId,   
        },        
        signers: [payer],
      }
    );
     
    let _recepient_after = await provider.connection.getBalance(recepientAccount.publicKey);
  
    let _vault_sol = await provider.connection.getBalance(vault_sol_account_pda);
    
    let _fee_after = await provider.connection.getBalance(feeAccount.publicKey);
          
    assert.ok(_recepient_before + transferAmount - 300 ==_recepient_after); 
    assert.ok(_fee_after - _fee_before==300); 
  });  
  
  it("Transfer tokens to wallet", async () => {
      
    let transferAmount = 750;
    
    //Make a transfer to wallets vault for tokens
    await program.rpc.transferFrom(
          new anchor.BN(transferAmount),      
      {
        accounts: {          
          walletAccount: walletAccount.publicKey,
          user: payer.publicKey,
          vaultAccount: vault_account_pda,
          userDepositTokenAccount: userTokenAccount,
          systemProgram: anchor.web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        },        
        signers: [payer],
      }
    );     
  
    let _vault = await mintToken.getAccountInfo(vault_account_pda);
     
    // Check new vault amount
    assert.ok(_vault.amount.toNumber()==transferAmount);
     
    let _userTokenAccount  = await mintToken.getAccountInfo(userTokenAccount);
     
    assert.ok(_userTokenAccount.amount.toNumber() == userAmount-transferAmount);
    
  });
  
  it("Transfer tokens from wallet", async () => {
     
    //Make a transfer from wallets vault for tokens
    await program.rpc.transferTo(
          new anchor.BN(transferBackAmount),      
      {
        accounts: {          
          walletAccount: walletAccount.publicKey,
          authority: payer.publicKey,
          vaultAuthority: vault_authority_pda,
          vaultAccount: vault_account_pda,
          userDepositTokenAccount: userTokenAccount,
          systemProgram: anchor.web3.SystemProgram.programId,            
          tokenProgram: TOKEN_PROGRAM_ID,
        },        
        signers: [payer],
      }
    );     
  
    let _vault = await mintToken.getAccountInfo(vault_account_pda);
     
    // Check new vault amount
    assert.ok(_vault.amount.toNumber()==transferAmount-transferBackAmount);
     
    let _userTokenAccount  = await mintToken.getAccountInfo(userTokenAccount);
     
    assert.ok(_userTokenAccount.amount.toNumber() == userAmount-transferAmount+transferBackAmount);
    
  });
  
  
  it("Set transfer allowance to recepient", async () => {
    
    //Setiing vault amount and recepient authority in walletAccount
    await program.rpc.allowTo(
          new anchor.BN(allowAmount),      
      {
        accounts: {          
          walletAccount: walletAccount.publicKey,
          authority: payer.publicKey,          
          vaultAccount: vault_account_pda,
          recepient: recepientAccount.publicKey,          
        },        
        signers: [payer],
      }
    );
    
    let _walletAccount = await program.account.walletAccount.fetch(
         walletAccount.publicKey
    );
    
    assert.ok(_walletAccount.allowance == true);    
    assert.ok(_walletAccount.recepient.equals(recepientAccount.publicKey));
    assert.ok(_walletAccount.allowanceValue == allowAmount);
    
  });
  
  
  it("Take allowance by recepient", async () => {
    
    //Take the allowance by recepient and zeroing aloowance state
    await program.rpc.takeAllowance(         
      {
        accounts: {
            
          walletAccount: walletAccount.publicKey,
          recepient: recepientAccount.publicKey,
          recepientAccount:recepientTokenAccount,
          vaultAuthority: vault_authority_pda,
          vaultAccount: vault_account_pda,
          systemProgram: anchor.web3.SystemProgram.programId,            
          tokenProgram: TOKEN_PROGRAM_ID,
          
        },        
        signers: [recepientAccount],
      }
    );
    
    let _walletAccount = await program.account.walletAccount.fetch(
         walletAccount.publicKey
    );
     
    let _recepientTokenAccount  = await mintToken.getAccountInfo(recepientTokenAccount);     
     
    assert.ok(_recepientTokenAccount.amount.toNumber() == allowAmount);
    assert.ok(_walletAccount.allowance == false);
    assert.ok(_walletAccount.allowanceValue == 0);
    
  });
  */
  
});
