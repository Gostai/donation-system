use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_spl::token::{
    self,     
    Mint, 
    MintTo,
    SetAuthority,
    TokenAccount,
    Transfer
    };
use spl_token::instruction::AuthorityType;
use std::str::FromStr;

declare_id!("EJvFwWhUFJdniQyK3JXkz5iBVzyMCHpp7qCSJbDn1UZ6");

#[program]
pub mod donations {
    use super::*;
    //Seed for collections PDA
    const COLLECTION_PDA_SEED: &[u8] = b"collection";
    
    //It's much secure to hardcode owner account to prevent initialization with
    //another system account and collecting rent instead of the owner
    const OWNER_ACCOUNT: &str = "4LnHwNdQCBEV9YHQtjz5oPYjZiJu7WYsFx9RGvTZmxYT";   
    
    //intialize collecting system    
    pub fn initialize_system(
        ctx: Context<InitializeSystem>,  
        authority: Pubkey,
        reward_period: u64,
        reward_value: u64,
    ) -> Result<()> {    
    
        //It's much secure to hardcode owner account to prevent initialization with
        //another system account and collecting rent instead of owner
        let owner_account_saved = Pubkey::from_str(OWNER_ACCOUNT)
                .expect("Unknown owner Account coded in smartcontract");
                
        require!(ctx.accounts.initializer.key()==
                owner_account_saved,
                MyError::UnknownOwner);
        //Initialize system account values        
        ctx.accounts.system_account.authority = authority;        
        ctx.accounts.system_account.reward_period = reward_period;
        
        let now_ts = Clock::get().unwrap().slot;
        ctx.accounts.system_account.last_reward_time = now_ts;
        
        ctx.accounts.system_account.reward_value = reward_value;    
        ctx.accounts.system_account.commission_gathered = 0;
        ctx.accounts.system_account.donors = vec![];
        ctx.accounts.system_account.collections=vec![];
        
        //Calculate PDA authority
        let (vault_authority, _vault_authority_bump) =
            Pubkey::find_program_address(
                &[COLLECTION_PDA_SEED],
                ctx.program_id
            );            
        //Move CHRT vault authority to PDA
        token::set_authority(
            ctx.accounts.into_set_authority_context(),
            AuthorityType::AccountOwner,
            Some(vault_authority),
        )?;
        //Move Mint authority to PDA
        token::set_authority(
            ctx.accounts.into_mint_set_authority_context(),
            AuthorityType::MintTokens,
            Some(vault_authority),
        )?;
        
        Ok(())
    }    
    
    //Initialize donation collection    
    pub fn initialize(
        ctx: Context<Initialize>,  
        authority: Pubkey, 
        //Fee in percents
        fee_value: u64,
        val_for_fee_exempt: u64,       
        val_for_closing: u64,
    ) -> Result<()> {
        //Set initializer authority 
        ctx.accounts.collection_account.authority = authority;
        //Set owner authority
        ctx.accounts.collection_account.owner =
            ctx.accounts.system_account.authority;
        //Add collection to collections vec
        ctx.accounts.system_account.collections.push(
            Collection{
                address: ctx.accounts.collection_account.key(),
                donated_amount: 0,   
                active: true,
            }
        );
        
        //Set fee value
        ctx.accounts.collection_account.fee_value = fee_value;
        //Set fee exemption value of contribution       
        ctx.accounts.collection_account.val_for_fee_exempt = val_for_fee_exempt;
        //Set closing value of contribution
        ctx.accounts.collection_account.val_for_closing = val_for_closing;
        //Set counters
        ctx.accounts.collection_account.contributed_amount = 0;
        //ctx.accounts.collection_account.donated_amount = 0;
        
        Ok(())
    }
    
    //Donate SOL to collection 
    pub fn donate( 
        ctx: Context<Donate>,        
        amount: u64,        
        ) -> Result<()> {
        
        let mut cur_i=0;
        for  (i, col) in ctx.accounts.system_account.collections.iter().enumerate() {
            if col.address==ctx.accounts.collection_account.key(){                    
                    cur_i=i;
                }
        }
        //Check that collection is not closed
        require!(ctx.accounts.system_account.collections[cur_i].active, MyError::CollectionIsInactive);
        
        //Check that donate amount is more then 0 lamports        
        require!(amount > 0, MyError::AmountTooSmall);      
        
        let mut fee_amount = 0;
        
        //Check for fee exemption
        if ctx.accounts.collection_account.val_for_fee_exempt >
            ctx.accounts.collection_account.contributed_amount {
            //Calculate fee amount
            fee_amount=
            fee_calculation(
                &ctx.accounts.collection_account.fee_value,
                &amount
            );   
        }
          
        //Check that donor have enouph lamports for donate  
        if **ctx.accounts.donor.try_borrow_lamports()? < amount + fee_amount  {
            return Err(error!(MyError::InsufficientFundsForTransaction));
        }
        
        //Transfer donate amount
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.donor.key(),
            &ctx.accounts.vault_sol_account.key(),
            amount + fee_amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.donor.to_account_info(),
                ctx.accounts.vault_sol_account.to_account_info(),
            ],
        )?;  
        
        //Change the count values
        ctx.accounts.system_account.collections[cur_i].donated_amount += amount;
        ctx.accounts.system_account.commission_gathered += fee_amount;
        
        
        //Find minimum donations donor in top10 list
        let mut cur_i =0;
        let (mut min, mut min_i) = (u64::MAX,  SystemAccount::MAX_DONORS);
        let mut found = false;
        
        for (i, don) in ctx.accounts.system_account.donors.iter().enumerate() {
            if don.amount < min {
                min = don.amount;
                min_i = i;
            }
            if don.address == ctx.accounts.donor_token_account.key() {
                cur_i = i;
                found = true;
                break;
            }
        }

        if !found {
            //insert new donor
            let donor = Donor {
                address: ctx.accounts.donor_token_account.key(),
                amount: amount, 
                last_reward_time: ctx.accounts.system_account.last_reward_time,               
            };

            if ctx.accounts.system_account.donors.len() < SystemAccount::MAX_DONORS {
                ctx.accounts.system_account.donors.push(donor);
            } else if min < amount {
                //or take place of minimal donor
                ctx.accounts.system_account.donors[min_i] = donor;
            }
        } else {
            //or encrease amount value if found donor
            ctx.accounts.system_account.donors[cur_i].amount += amount;
        }
        
        //Calculate mint authority for referer reward
        let (_vault_authority, vault_authority_bump) =
            Pubkey::find_program_address(&[COLLECTION_PDA_SEED],
                    ctx.program_id);
        let authority_seeds = &[&COLLECTION_PDA_SEED[..],
            &[vault_authority_bump]];
        
        //Calculate reward amount
        let reward_amount = reward_calculation(&101, &amount);
        
        //Transfer CHRT rewards to referer acoount       
        token::mint_to(
                ctx.accounts.into_mint_to_donor_context()
                .with_signer(&[&authority_seeds[..]]),
                reward_amount,
        )?;     
        
        //Emit donation event
        emit!(DonationEvent{
            at: Clock::get()?.unix_timestamp,
            amount: amount,
            from: ctx.accounts.donor.key(),
            collection: ctx.accounts.collection_account.key(),
            collected_amount:  ctx.accounts.system_account.collections[cur_i].donated_amount,            
        });
             
        Ok(())
    }    
    
    //Withdrow donations to donee
    pub fn withdraw_donations( 
        ctx: Context<WithdrawDonations>,        
        amount: u64,        
        ) -> Result<()> {        
        let mut cur_i=0;
        for  (i, col) in ctx.accounts.system_account.collections.iter().enumerate() {
            if col.address==ctx.accounts.collection_account.key(){                    
                    cur_i=i;
                }
        }
        //Check that transfer amount is more then 0 tokens        
        require!(amount > 0, MyError::AmountTooSmall);
        
        //Check that queried amount is less then collected
        require!(
            amount <= ctx.accounts.system_account.collections[cur_i].donated_amount,
            MyError::WithdrawAmountTooSmall
        );
               
        //Check vault have queried lamports
        if **ctx.accounts
            .vault_sol_account
            .try_borrow_lamports()? < amount  {
            return Err(error!(MyError::InsufficientFundsForTransaction));
        }
        
        //Recomended by solana way to transfer lamports from PDA
        //https://solanacookbook.com/references/programs.html#how-to-transfer-sol-in-a-program
        //Transfer queried qmount from vault to donee
        **ctx.accounts.vault_sol_account.try_borrow_mut_lamports()? -= amount ;
        **ctx.accounts.authority.try_borrow_mut_lamports()? += amount;  
        
        //Change amount counter
        ctx.accounts.system_account.collections[cur_i].donated_amount-= amount;   
        
        //Emit withdraw donation event
        emit!(WithdrawDonationEvent{
            at: Clock::get()?.unix_timestamp,
            amount: amount,
            to: ctx.accounts.authority.key(),
            collection: ctx.accounts.collection_account.key(),
            remaining_amount: ctx.accounts.system_account.collections[cur_i].donated_amount,            
        });
        
        Ok(())
    }
    
    //Withdrow commission to owner with decided amount
    pub fn withdraw_commission( 
        ctx: Context<WithdrawCommission>,        
        amount: u64,        
        ) -> Result<()> {
        //Check that transfer amount is more then 0 tokens        
        require!(amount > 0, MyError::AmountTooSmall);
        
        //Check that queried amount is less then gathered
        require!(
            amount <= ctx.accounts.system_account.commission_gathered,
            MyError::CommissionAmountTooSmall
        );
                        
        //Check vault have queried lamports
        if **ctx.accounts
            .vault_sol_account
            .try_borrow_lamports()? < amount  {
            return Err(error!(MyError::InsufficientFundsForTransaction));
        }
        
        //Recomended by solana way to transfer lamports from PDA
        //https://solanacookbook.com/references/programs.html#how-to-transfer-sol-in-a-program
        //Transfer queried qmount from vault to owner
        **ctx.accounts.vault_sol_account.try_borrow_mut_lamports()? -= amount ;
        **ctx.accounts.authority.try_borrow_mut_lamports()? += amount;  
        
        //Change amount counter
        ctx.accounts.system_account.commission_gathered-= amount;
        
        Ok(())
    }    
    
    pub fn reward_donor( 
        ctx: Context<RewardDonor>,      
        ) -> Result<()> {
        //Save initial values
        let now_ts = Clock::get().unwrap().slot;
        let mut last_reward_time=0;
        let mut cur_i=0;
        
        //Find CHRT account in top10  
        for (i, don) in ctx.accounts.system_account.donors.iter().enumerate() {
            if don.address ==ctx.accounts.donor_token_account.key() {
                last_reward_time = don.last_reward_time;
                cur_i=i;
                break;
            }        
        }
        
        //Check if account not found
        require!(last_reward_time!=0,MyError::DonorNotInTop);
        
        //Check that reward time is over
        require!(
            now_ts - last_reward_time >
                ctx.accounts.system_account.reward_period,
            MyError::EarlyRewardTime
        );
                
        //Calculate mint authority
        let (_vault_authority, vault_authority_bump) =
            Pubkey::find_program_address(&[COLLECTION_PDA_SEED],
                    ctx.program_id);
        let authority_seeds = &[&COLLECTION_PDA_SEED[..],
            &[vault_authority_bump]];
                
        
        //Transfer CHRT rewards to donor acoounts    
        token::mint_to(
                ctx.accounts.into_mint_to_donor_context()
                .with_signer(&[&authority_seeds[..]]),
                ctx.accounts.system_account.reward_value,
        )?;

        //Update the reward timestamp
        ctx.accounts.system_account.donors[cur_i].last_reward_time = now_ts;  
        
        //Emit reward donors event
        emit!(RewardEvent{
            at: Clock::get()?.unix_timestamp,
            amount: ctx.accounts.system_account.reward_value,                      
        });
        
        Ok(())
    }
    
    
    pub fn stop_collection( 
        ctx: Context<StopCollection>,  
        ) -> Result<()> {
        
        let mut cur_i=0;
        for  (i, col) in ctx.accounts.system_account.collections.iter().enumerate() {
            if col.address==ctx.accounts.collection_account.key(){                    
                    cur_i=i;
                }
        }
        
        //Check that collection is not closed
        require!(ctx.accounts.system_account.collections[cur_i].active, MyError::CollectionIsInactive);
        
        //Mark collection as closed
        ctx.accounts.system_account.collections[cur_i].active=false;
        
        Ok(())
    }
    
    //Contribute tokens to the collection
    pub fn contribute_tokens( 
        ctx: Context<ContributeTokens>,        
        amount: u64,        
        ) -> Result<()> {
        
        let mut cur_i=0;
        for  (i, col) in ctx.accounts.system_account.collections.iter().enumerate() {
            if col.address==ctx.accounts.collection_account.key(){                    
                    cur_i=i;
                }
        }
        
        //Check that collection is not closed
        require!(ctx.accounts.system_account.collections[cur_i].active, MyError::CollectionIsInactive);
        
        //Check that transfer amount is more then 0 tokens 
        require!(amount > 0, MyError::AmountTooSmall);
        
        //Check that user have enouph tokens for transfer
        require!(ctx.accounts.contributor_token_account.amount >= amount, MyError::InsuficientUserFunds);        
        
        //Transfer user's tokens to treasury acount
        token::transfer(
            ctx.accounts.into_transfer_to_pda_context(),
            amount,
        )?;
        
        //Increase collection contribution counter 
        ctx.accounts.collection_account.contributed_amount+=amount;   
        
        //Mark collection as closed if amount is of val for closing
        if amount==ctx.accounts.collection_account.val_for_closing {
            msg!("User contributed especial for closing the collection number of tokens {}", amount);
            //Mark closing
            ctx.accounts.system_account.collections[cur_i].active = false;
            
            //Save balance of closed collection
            let balance = ctx.accounts.system_account.collections[cur_i].donated_amount;
            
            //init counters
            let mut sum = 0;
            let mut distributed = 0;
            let mut part:u64;
            
            //Distribute the closed collection donations to active donations
                        
            //Much iterations eat compute units of programm
            for col in ctx.accounts.system_account.collections.iter() {
                if col.active {
                    sum+=col.donated_amount;
                }                
            }
            
            if sum!=0 {
                let collections = ctx.accounts.system_account.collections.clone();
                for  (i,col) in collections.iter().enumerate() {
                    if col.active {
                        if i < collections.len()-1 {
                            part=part_calculation(&col.donated_amount,&sum,&balance);
                            ctx.accounts.system_account.collections[i].donated_amount=
                                part+col.donated_amount;
                            distributed+=part;                            
                        } else {
                            ctx.accounts.system_account.collections[i].donated_amount=
                                balance - distributed + col.donated_amount;                            
                        }  
                    }
                }
            }
            ctx.accounts.system_account.collections[cur_i].donated_amount=0;
        }
        
        Ok(())
    }   
}

#[derive(Accounts)]
pub struct InitializeSystem<'info> {
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut, signer)]
    pub initializer: AccountInfo<'info>,    
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(
        init,
        seeds = [b"sol-seed".as_ref()],        
        payer = initializer,
        bump,
        space = 8 + 8,
    )]
    pub vault_sol_account: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account        
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    /// CHECK: This is not dangerous because we don't read or write from this account        
    #[account(mut, signer)]
    pub mint_authority: AccountInfo<'info>,
    #[account(
        init,
        seeds = [b"token-seed".as_ref()],
        bump,
        payer = initializer,
        token::mint = mint,
        token::authority = initializer,
    )]
    pub vault_account: Account<'info, TokenAccount>,    
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub system_program: AccountInfo<'info>,  
    pub rent: Sysvar<'info, Rent>,    
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,
    #[account(
        init,
        payer = initializer,
        space = 8 + SystemAccount::MAXIMUM_SIZE
    )]
    pub system_account: Box<Account<'info, SystemAccount>>,    
}


impl<'info> InitializeSystem<'info> {
    
    fn into_set_authority_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            account_or_mint: self.vault_account.to_account_info().clone(),
            current_authority: self.initializer.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
    
    fn into_mint_set_authority_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            account_or_mint: self.mint.to_account_info().clone(),
            current_authority: self.mint_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
} 

#[derive(Accounts)]
pub struct Initialize<'info> {
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut, signer)]
    pub initializer: AccountInfo<'info>,  
    #[account(mut)]
    pub system_account: Box<Account<'info, SystemAccount>>, 
    #[account(zero)]
    pub collection_account: Box<Account<'info, CollectionAccount>>,   
}

#[derive(Accounts)]
pub struct Donate<'info> {      
    #[account(mut)]
    pub collection_account: Box<Account<'info, CollectionAccount>>,     
    #[account(mut)]
    pub system_account: Box<Account<'info, SystemAccount>>, 
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut, signer)]
    pub donor: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub donor_token_account: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub vault_sol_account: AccountInfo<'info>,   
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub owner_account: AccountInfo<'info>,  
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,  
    /// CHECK: This is not dangerous because we don't read or write from this account        
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub referer_token_account : AccountInfo<'info>,  
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub vault_authority: AccountInfo<'info>,    
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,   
}

impl<'info> Donate <'info> {
    fn into_mint_to_donor_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        let cpi_accounts = MintTo {
            mint: self.mint.to_account_info().clone(),
            to: self
                .referer_token_account
                .to_account_info()
                .clone(),
            authority: self.vault_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }        
}

#[derive(Accounts)]
pub struct WithdrawDonations<'info> {        
    #[account(mut, has_one = authority)]
    pub collection_account: Box<Account<'info, CollectionAccount>>, 
    #[account(mut)]
    pub authority: Signer<'info>,      
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub vault_sol_account: AccountInfo<'info>, 
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,     
    #[account(mut)]
    pub system_account: Box<Account<'info, SystemAccount>>, 
}

#[derive(Accounts)]
pub struct WithdrawCommission<'info> {
    #[account(mut, has_one = authority)]
    pub system_account: Box<Account<'info, SystemAccount>>, 
    #[account(mut)]
    pub authority: Signer<'info>,   
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub vault_sol_account: AccountInfo<'info>, 
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,     
}


#[derive(Accounts)]
pub struct RewardDonor<'info> {
    #[account(mut, has_one = authority)]
    pub system_account: Box<Account<'info, SystemAccount>>, 
    #[account(mut)]
    pub authority: Signer<'info>,     
    /// CHECK: This is not dangerous because we don't read or write from this account        
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub vault_authority: AccountInfo<'info>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub donor_token_account: AccountInfo<'info>,  
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,   
}

impl<'info> RewardDonor <'info> {
    fn into_mint_to_donor_context(
        &self        
    ) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        let cpi_accounts = MintTo {
            mint: self.mint.to_account_info().clone(),
            to: self
                .donor_token_account
                .to_account_info()
                .clone(),
            authority: self.vault_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct StopCollection<'info> {        
    #[account(mut, has_one = authority)]
    pub collection_account: Box<Account<'info, CollectionAccount>>,     
    #[account(mut)]
    pub authority: Signer<'info>,      
    #[account(mut)]
    pub system_account: Box<Account<'info, SystemAccount>>,        
}

#[derive(Accounts)]
pub struct ContributeTokens<'info> {        
    #[account(mut)]
    pub collection_account: Box<Account<'info, CollectionAccount>>,      
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut, signer)]
    pub contributor: AccountInfo<'info>,
    #[account(mut)]
    pub vault_account: Account<'info, TokenAccount>,    
    #[account(mut)]
    pub contributor_token_account: Account<'info, TokenAccount>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,       
    /// CHECK: This is not dangerous because we don't read or write from this account
    pub token_program: AccountInfo<'info>,
    #[account(mut)]
    pub system_account: Box<Account<'info, SystemAccount>>,    
}

impl<'info> ContributeTokens<'info> {
    fn into_transfer_to_pda_context(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self
                .contributor_token_account
                .to_account_info()
                .clone(),
            to: self.vault_account.to_account_info().clone(),
            authority: self.contributor.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }    
}
  
#[account]
pub struct SystemAccount {      
    pub authority: Pubkey,
    pub reward_period: u64,
    pub last_reward_time: u64,
    pub reward_value: u64,
    pub commission_gathered: u64,
    pub donors: Vec<Donor>,
    pub collections: Vec<Collection>,
}

impl SystemAccount {
    pub const MAX_DONORS: usize = 10;
    pub const MAX_COLLECTIONS: usize = 100;
    //Problem is in Solana account size max for 10 MB
    //Pubkey + u64 + u64 +u64 + u64 + Vec (Pubkey + u64 + u64 ) + Vec(Pubkey+u64+bool)
    const MAXIMUM_SIZE: usize = 32 + 8 + 8 + 8 + 8 +
        4 + (32 + 8 + 8)*SystemAccount::MAX_DONORS +
        4 + (32 + 8 + 1 )* SystemAccount::MAX_COLLECTIONS; 
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct Donor {
    pub address: Pubkey,
    pub amount: u64,
    pub last_reward_time: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct Collection {
    pub address: Pubkey,
    pub donated_amount: u64,  
    pub active: bool, 
}

#[account]
pub struct CollectionAccount {  
    pub owner: Pubkey,
    pub authority: Pubkey,    
    pub reward_period: u64,
    pub last_reward_time: u64,
    pub reward_value: u64,
    pub fee_value: u64,
    pub val_for_fee_exempt: u64,
    pub val_for_closing: u64,
    pub contributed_amount: u64,    
}

fn fee_calculation ( &fee_value: &u64, &amount: &u64)-> u64 {    
    let mut fee_amount = (fee_value * amount)/100;
    let reminder = (fee_value * amount)%100;
                
        if reminder!=0{
            if ((amount * 10 )/reminder) > 4 {
                fee_amount+=1;
            } 
        }
     fee_amount       
}

fn part_calculation ( &numretor: &u64, &denominator: &u64, &total: &u64 )-> u64 {    
    let mut part_amount = total*numretor / denominator;
    let reminder =total* numretor % denominator;
                
        if reminder!=0{
            if ((total * 10 )/reminder) > 4 {
                part_amount+=1;
            } 
        }
     part_amount       
}

fn reward_calculation ( &reward_value: &u64, &amount: &u64)-> u64 {  
    //amount leaded to SOL, multed to reward, and leade to CHRT
    let mut reward_amount = 1000*(reward_value * amount)/1000000000;
    let reminder = 1000*(reward_value * amount)%1000000000;
                
        if reminder!=0{
            if ((amount * 10 )/reminder) > 4 {
                reward_amount+=1;
            } 
        }
    reward_amount       
}

#[error_code]
pub enum MyError {    
    #[msg("Program may only accept donates or contributions more then 0")]
    AmountTooSmall,
    #[msg("Donated amount is lower then queried")]
    WithdrawAmountTooSmall,
    #[msg("Collected commission amount is lower then queried")]
    CommissionAmountTooSmall,   
    #[msg("User dont have enouph CHRT for the contribution")]
    InsuficientUserFunds,
    #[msg("The provided owner account is unknown")]
    UnknownOwner,        
    #[msg("Donor provided for reward is not in top of donors")]
    DonorNotInTop,
    #[msg("The reward can not be done because of reward period still goes on")]
    EarlyRewardTime,
    #[msg("There is not enougph SOL to make an operation")]
    InsufficientFundsForTransaction,
    #[msg("Program does not works with inactive collections")]
    CollectionIsInactive,   
}

#[event]
pub struct DonationEvent {
    at: i64,    
    amount: u64,
    from: Pubkey,
    collection: Pubkey,
    collected_amount: u64,    
}

#[event]
pub struct WithdrawDonationEvent {
    at: i64,    
    amount: u64,
    to: Pubkey,
    collection: Pubkey,
    remaining_amount: u64,    
}

#[event]
pub struct RewardEvent {
    at: i64,    
    amount: u64,    
}
