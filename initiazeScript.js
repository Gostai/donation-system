// Parse arguments
// --program - [Required] The account address for your deployed program.
// --feed - The account address for the Chainlink data feed to retrieve
const anchor = require("@project-serum/anchor");
const token = require("@solana/spl-token");
//onst solanaWeb3 = require('@solana/web3.js');
//const {PublicKey} = require("@solana/web3.js");

const args = require('minimist')(process.argv.slice(2));

// Initialize Anchor and provider
const provider = anchor.Provider.env();
// Configure the cluster.
anchor.setProvider(provider);

//decimals 3
let CHRT = 1000;

let max_collections = new anchor.BN(100);
let top_platform = new anchor.BN(100);
let reward_period = new anchor.BN(2);
let reward_value = new anchor.BN(1000*CHRT);


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
  const kp = JSON.parse(
    require("fs").readFileSync("./id.json", "utf8")
  );  
  
  //Create owner account
  const arr = Object.values(kp);
  const secret = new Uint8Array(arr);
  const ownerAccount = anchor.web3.Keypair.fromSecretKey(secret);    

  console.log("pk",ownerAccount.publicKey.toString());
    
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
    let [systemAccount] = await find_systemAccount(provider.wallet.publicKey, programId);        
    let [top100Account] = await find_top100Account(provider.wallet.publicKey, programId);   
       
    
    //Create token mint for CHRT 
    mintToken = await token.Token.createMint(
      provider.connection,
      ownerAccount,
      ownerAccount.publicKey,
      null,
      3,
      token.TOKEN_PROGRAM_ID
    );
    
    console.log("mintToken.publicKey",mintToken.publicKey.toString());
    console.log("systemAccount",systemAccount.toString());
    console.log("top100Account",top100Account.toString());
    
    
    //Initialize system account for donation system
    const tx = program.transaction.initializeSystem(  
        max_collections,
        top_platform,
	    reward_period,
	    reward_value,
      {
        accounts: {
          initializer: ownerAccount.publicKey,          
          vaultSolAccount: vault_sol_account_pda,
          mint: mintToken.publicKey,  
          mintAuthority: ownerAccount.publicKey,
          vaultAccount: vault_account_pda,          
          systemProgram: anchor.web3.SystemProgram.programId,  
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemAccount: systemAccount,
          top100Account: top100Account,
        },    
        signers: [
            ownerAccount,  
            ownerAccount
        ],
      }
    );     
    
    //Signing created transaction with cmd wallet
    tx.feePayer = await provider.wallet.publicKey;
    tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash;
    
    const signedTx = await provider.wallet.signTransaction(tx);
    const txId = await provider.connection.sendRawTransaction(signedTx.serialize());
    await provider.connection.confirmTransaction(txId)
    
    console.log("Fetching transaction logs...");
    let t = await provider.connection.getConfirmedTransaction(txId, "confirmed");
    console.log(t.meta.logMessages);
    
}

console.log("Running client...");
main().then(() => console.log("Success"));
