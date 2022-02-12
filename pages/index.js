import Head from 'next/head'
import Image from 'next/image'
import styles from '../styles/Home.module.css'
import { Contract, ethers, providers } from 'ethers';
import { formatEther } from 'ethers/lib/utils';
import Web3Modal from 'web3modal';
import { CRYPTODEVS_DAO_ABI, CRYPTODEVS_DAO_CONTRACT_ADDRESS, CRYPTODEVS_NFT_ABI, CRYPTODEVS_NFT_CONTRACT_ADDRESS } from  '../constants';
import React, { useState, useEffect, useRef } from 'react';

export default function Home() {
  // ETH Balance of the DAO contract
  const [treasuryBalance, setTreasuryBalance] = useState("0");
  // Number of proposals created in the DAO
  const [numProposals, setNumProposals] = useState("0");
  // Array of all proposals created in the DAO
  const [proposals, setProposals] = useState([]);
  // User's balance of CryptoDevs NFTs
  const [nftBalance, setNftBalance] = useState(0);
  // Fake NFT Token ID to purchase. Used when creating a proposal.
  const [fakeNftTokenId, setFakeNftTokenId] = useState("");
  // One of "Create Proposal" or "View Proposals"
  const [selectedTab, setSelectedTab] = useState("");
  // True if waiting for a transaction to be mined, false otherwise.
  const [loading, setLoading] = useState(false);
  // True if user has connected their wallet, false otherwise
  const [walletConnected, setWalletConnected] = useState(false);
  const web3ModalRef = useRef();

  useEffect(() => {
    if (!walletConnected) {
      web3ModalRef.current = new Web3Modal({
        network: "rinkeby",
        providerOptions: {},
        disableInjectedProvider: false
      });

      connectWallet().then(() => {
        getDAOTreasuryBalance();
        getUserNFTBalance();
        getNumProposalsInDAO();
      })
    }
    console.log(fetchProposalById("1"))
  }, [walletConnected])

  useEffect(() => {
    if (selectedTab === "View Proposals") {
      fetchAllProposals();
    }
  }, [selectedTab]);

  const connectWallet = async () => {
    try {
      await getProviderOrSigner();
      setWalletConnected(true);
    } catch (e) {
      console.log(e);
    }
  }

  const getDAOTreasuryBalance = async () => {
    try  {
      let provider = await getProviderOrSigner();
      const balance = await provider.getBalance(
        CRYPTODEVS_DAO_CONTRACT_ADDRESS
      );
      console.log("DAO Treasury Balance: ", formatEther(balance))
      setTreasuryBalance(balance.toString());
    } catch (e) {
      console.log(e);
    }
  }

  const getNumProposalsInDAO = async () => {
    try {
      let provider = await getProviderOrSigner();
      let daoContract = getDaoContractInstance(provider);
      let _numProposals = await daoContract.numProposals();
      console.log("Number of proposals: %s", _numProposals.toString());
      setNumProposals(_numProposals.toString());
    } catch (e) {
      console.log(e);
    }
  }

  const getUserNFTBalance = async () => {
    try {
      let signer = await getProviderOrSigner(true);
      let nftContract = getCryptodevsNFTContractInstance(signer);
      let userAddress = await signer.getAddress();
      let _userNFTBalance = await nftContract.balanceOf(userAddress);
      console.log("User NFT Balance: ", _userNFTBalance.toNumber());
      setNftBalance(_userNFTBalance.toNumber())
    } catch (e) {
      console.log(e);
    }
  }

  const createProposal = async () => {
    try {
      let signer = await getProviderOrSigner(true);
      let daoContract = getDaoContractInstance(signer);
      let tx = await daoContract.createProposal(fakeNftTokenId);
      setLoading(true);
      await tx.wait()
      await getNumProposalsInDAO();
      setLoading(false);
    } catch (e) {
      console.log(e);
      window.alert(e.message);
    }
  }

  const fetchProposalById = async (id) => {
    try {
      let provider = await getProviderOrSigner();
      let daoContract = getDaoContractInstance(provider);
      let proposal = await daoContract.proposals(id);
      let parsedProposal = {
        proposalId: id,
        nftTokenId: proposal.nftTokenId.toString(),
        deadline: new Date(parseInt(proposal.deadline.toString()) * 1000),
        yayVotes: proposal.yayVotes.toString(),
        nayVotes: proposal.nayVotes.toString(),
        executed: proposal.executed,
      };
      return parsedProposal;
    } catch (e) {
      console.log(e);
    }
  }

  const fetchAllProposals = async () => {
    try {
      let provider = await getProviderOrSigner();
      let daoContract = getDaoContractInstance(provider);
      let _numProposals = await daoContract.numProposals();
      _numProposals = _numProposals.toNumber();

      let proposals = [];
      for (let i = 0; i < _numProposals; i++) {
        let currentProposal = await fetchProposalById(i);
        proposals.push(currentProposal);
      }
      console.log(proposals);
      setProposals(proposals);
      return proposals;
    } catch (e) {
      console.log(e);
    }
  }

  const voteOnProposal = async (proposalId, _vote) => {
    try {
      let signer = await getProviderOrSigner(true);
      let daoContract = getDaoContractInstance(signer);
      let vote = _vote === "YAY" ? 0 : 1;
      let tx = await daoContract.voteOnProposal(proposalId, vote);
      setLoading(true);
      await tx.wait();
      setLoading(false);
      await fetchAllProposals();
    } catch (e) {
      console.log(e);
      window.alert(e.data.message);
    }
  }

  const executeProposal = async (proposalId) => {
    try {
      let signer = await getProviderOrSigner(true);
      let daoContract = getDaoContractInstance(signer);
      let tx = await daoContract.executeProposal(proposalId);
      setLoading(true);
      await tx.wait();
      setLoading(false);
      await fetchAllProposals();
    } catch (e) {
      console.log(e);
      window.alert(e.data.message);
    }
  }

  const getProviderOrSigner = async (needSigner = false) => {
    try {
      let provider = await web3ModalRef.current.connect();
      let web3Provider = new providers.Web3Provider(provider);
      
      const { chainId } = await web3Provider.getNetwork();
      if (chainId !== 4) {
        window.alert("Please change it rinkeby testnet")
        throw new Error("Please use Rinkeby testnet")
      }

      if (needSigner) {
        let signer = web3Provider.getSigner();
        return signer;
      }
      return web3Provider;
    } catch (e) {
      console.log(e);
    }
  }

  const getDaoContractInstance = (providerOrSigner) => {
    return new Contract(
      CRYPTODEVS_DAO_CONTRACT_ADDRESS,
      CRYPTODEVS_DAO_ABI,
      providerOrSigner
    )
  }

  const getCryptodevsNFTContractInstance = (providerOrSigner) => {
    return new Contract(
      CRYPTODEVS_NFT_CONTRACT_ADDRESS,
      CRYPTODEVS_NFT_ABI,
      providerOrSigner
    )
  }

  // Render the contents of the appropriate tab based on `selectedTab`
  function renderTabs() {
    if (selectedTab === "Create Proposal") {
      return renderCreateProposalTab();
    } else if (selectedTab === "View Proposals") {
      return renderViewProposalsTab();
    }
    return null;
  }

  // Renders the 'Create Proposal' tab content
  function renderCreateProposalTab() {
    if (loading) {
      return (
        <div className={styles.description}>
          Loading... Waiting for transaction...
        </div>
      );
    } else if (nftBalance === 0) {
      return (
        <div className={styles.description}>
          You do not own any CryptoDevs NFTs. <br />
          <b>You cannot create or vote on proposals</b>
        </div>
      );
    } else {
      return (
        <div className={styles.container}>
          <label>Fake NFT Token ID to Purchase: </label>
          <input
            placeholder="0"
            type="number"
            onChange={(e) => setFakeNftTokenId(e.target.value)}
          />
          <button className={styles.button2} onClick={createProposal}>
            Create
          </button>
        </div>
      );
    }
  }

  // Renders the 'View Proposals' tab content
  function renderViewProposalsTab() {
    if (loading) {
      return (
        <div className={styles.description}>
          Loading... Waiting for transaction...
        </div>
      );
    } else if (proposals.length === 0) {
      return (
        <div className={styles.description}>
          No proposals have been created
        </div>
      );
    } else {
      return (
        <div>
          {proposals.map((p, index) => (
            <div key={index} className={styles.proposalCard}>
              <p>Proposal ID: {p.proposalId}</p>
              <p>Fake NFT to Purchase: {p.nftTokenId}</p>
              <p>Deadline: {p.deadline.toLocaleString()}</p>
              <p>Yay Votes: {p.yayVotes}</p>
              <p>Nay Votes: {p.nayVotes}</p>
              <p>Executed?: {p.executed.toString()}</p>
              {p.deadline.getTime() > Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button
                    className={styles.button2}
                    onClick={() => voteOnProposal(p.proposalId, "YAY")}
                  >
                    Vote YAY
                  </button>
                  <button
                    className={styles.button2}
                    onClick={() => voteOnProposal(p.proposalId, "NAY")}
                  >
                    Vote NAY
                  </button>
                </div>
              ) : p.deadline.getTime() < Date.now() && !p.executed ? (
                <div className={styles.flex}>
                  <button
                    className={styles.button2}
                    onClick={() => executeProposal(p.proposalId)}
                  >
                    Execute Proposal{" "}
                    {p.yayVotes > p.nayVotes ? "(YAY)" : "(NAY)"}
                  </button>
                </div>
              ) : (
                <div className={styles.description}>Proposal Executed</div>
              )}
            </div>
          ))}
        </div>
      );
    }
  }
  return (
    <div>
      <Head>
        <title>CryptoDevs DAO</title>
        <meta name="description" content="CryptoDevs DAO" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.main}>
        <div>
          <h1 className={styles.title}>Welcome to Crypto Devs!</h1>
          <div className={styles.description}>Welcome to the DAO!</div>
          <div className={styles.description}>
            Your CryptoDevs NFT Balance: {nftBalance}
            <br />
            Treasury Balance: {formatEther(treasuryBalance)} ETH
            <br />
            Total Number of Proposals: {numProposals}
          </div>
          <div className={styles.flex}>
            <button
              className={styles.button}
              onClick={() => setSelectedTab("Create Proposal")}
            >
              Create Proposal
            </button>
            <button
              className={styles.button}
              onClick={() => setSelectedTab("View Proposals")}
            >
              View Proposals
            </button>
          </div>
          {renderTabs()}
        </div>
        <div>
          <img className={styles.image} src="/cryptodevs/0.svg" />
        </div>
      </div>

      <footer className={styles.footer}>
        Made with &#10084; by Crypto Devs
      </footer>
    </div>
  )
}
