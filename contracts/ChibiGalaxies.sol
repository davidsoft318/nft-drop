// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract Generation1s {
    function balanceOf(address owner) public view virtual returns (uint256) {}
}

contract Generation2s {
    function balanceOf(address owner) public view virtual returns (uint256) {}
}

contract ChibiGalaxies is ERC721, Pausable, Ownable {

    using Address for address;
    using MerkleProof for bytes32[];

    string public baseTokenURI;

    uint public preMintPrice = 0.06 ether;
    uint public publicMintPrice = 0.08 ether;
    uint public collectionSize = 7000;
    uint public maxItemsPerTx = 5;
    uint public currentGiveawayTokenId = 1;
    uint public maxGiveawayTokenId = 100;
    uint public nextRareTokenIdToMint = 101;
    uint public nextRareTokenIdToClaim = 101;
    uint public maxRareTokenId = 250;
    uint public currentOtherTokenId = 251;
    uint public totalSupply = 0;
    uint public maxItemsForSpecialMint = 2;

    bool public onlyWhitelistedCanMint = true;

    bool public specialEventMintPaused = true;
    bool public preMintPaused = true;
    bool public publicMintPaused = true;

    bytes32 generation1HoldersMerkleRoot;
    bytes32 whitelistMerkleRoot;
    bytes32 specialEventWhitelistMerkleRoot;

    mapping(address => uint) public ownerRareTokens;
    mapping(address => uint) public specialMintTokens;

    event Mint(address indexed owner, uint256 tokenId);

    Generation1s gen1ContractInstance;
    Generation2s gen2ContractInstance;

    constructor() ERC721("ChibiGalaxies", "CHIBIGALAXY") {
        // contract paused by default
        pause();
    }

    /*
    GIVEAWAY FUNCTIONS - START
    */
    function giveawayMint(address to, uint amount) external onlyOwner {
        require((currentGiveawayTokenId + amount) <= maxGiveawayTokenId, "surpasses cap");
        _mintWithoutValidation(to, currentGiveawayTokenId, amount);
        currentGiveawayTokenId += amount;
    }
    /*
    GIVEAWAY FUNCTIONS - END
    */

    /*
    RARE MINT FUNCTIONS - START
    */
    function setGeneration1HoldersMerkleRoot(bytes32 _generation1HoldersMerkleRoot) public onlyOwner {
        generation1HoldersMerkleRoot = _generation1HoldersMerkleRoot;
    }

    function isAddressAGeneration1Holder(bytes32[] memory proof, address _address) public view returns (bool) {
        return isAddressInMerkleRoot(generation1HoldersMerkleRoot, proof, _address);
    }

    function rareMintAmount() public view returns (uint) {
        uint numGen1sOwned = numGeneration1sOwned();
        uint numGen2sOwned = numGeneration2sOwned();
        return calculateRareMintAmount(numGen1sOwned, numGen2sOwned);
    }

    function rareMint(uint amount) external onlyOwner {
        // minus 1 from amount because the nextRareTokenIdToMint value is the first token id minted during this run.
        require((nextRareTokenIdToMint + (amount-1)) <= maxRareTokenId, "surpass cap");
        _mintWithoutValidation(address(this), nextRareTokenIdToMint, amount);
        ownerRareTokens[address(this)] += amount;
        nextRareTokenIdToMint += (amount-1);
    }

    function claimRareToken(bytes32[] memory proof) external whenNotPaused {
        require(ownerRareTokens[address(this)] > 0, "all claimed");

        // wallet should be part of the gen1 snapshot
        require(isAddressAGeneration1Holder(proof, msg.sender), "not part of snapshot");

        uint numGen1sOwned = numGeneration1sOwned();
        uint numGen2sOwned = numGeneration2sOwned();

        uint amount = calculateRareMintAmount(numGen1sOwned, numGen2sOwned);

        // not eligible to claim any rares
        require((amount > 0 && ownerRareTokens[msg.sender] < amount), "not eligible");

        // a wallet with a gen 1 and 2 can claim a token.
        for (uint i = 0; i < amount; i++) {
            _transfer(address(this), msg.sender, nextRareTokenIdToClaim + i);
        }

        ownerRareTokens[msg.sender] += amount;
        ownerRareTokens[address(this)] -= amount;
        nextRareTokenIdToClaim += amount;
    }
    /*
    RARE MINT FUNCTIONS - END
    */

    /*
    PRE MINT - START
    */
    function setPreMintPaused(bool _preMintPaused) public onlyOwner {
        preMintPaused = _preMintPaused;
    }

    function preMint() external payable whenNotPaused {
        // preMintPaused is set by owner calling pausePreMint and unpausePreMint
        require(!preMintPaused, "mint paused");
        // verify that the client sent enough eth to pay for the mint
        uint remainder = msg.value % preMintPrice;
        require(remainder == 0, "send a divisible amount of eth");

        // calculate the amount of tokens we are minting based on the amount of eth sent
        uint amount = msg.value / preMintPrice;
        require(amount > 0, "amount to mint is 0");

        uint numGen1sOwned = numGeneration1sOwned();
        uint numGen2sOwned = numGeneration2sOwned();

        // only gen 1 or gen 2 owners can pre mint.
        require((numGen1sOwned > 0 || numGen2sOwned > 0), "not eligible");

        // calculate the max number of items to mint. (3 passes per gen 1, 1 pass per gen 2)
        uint maxItemsForPreMint = (numGen1sOwned * 3) + (numGen2sOwned * 1);

        uint numGeneration3sOwned = balanceOf(msg.sender);
        require((numGeneration3sOwned + amount) <= maxItemsForPreMint, "surpass pre mint cap");

        _mintWithoutValidation(msg.sender, currentOtherTokenId, amount);
        currentOtherTokenId += amount;
    }
    /*
    PRE MINT - END
    */

    /*
     SPECIAL EVENT MINT FUNCTIONS - BEGIN
     */
    function setSpecialEventMintInfo(bool _specialEventMintPaused, uint _maxItemsForSpecialMint, bytes32 _specialEventWhitelistMerkleRoot) public onlyOwner {
        specialEventMintPaused = _specialEventMintPaused;
        specialEventWhitelistMerkleRoot = _specialEventWhitelistMerkleRoot;
        maxItemsForSpecialMint = _maxItemsForSpecialMint;
    }

    function isAddressWhitelistedForSpecialEvent(bytes32[] memory proof, address _address) public view returns (bool) {
        return isAddressInMerkleRoot(specialEventWhitelistMerkleRoot, proof, _address);
    }

    function specialEventMint(bytes32[] memory proof) external payable whenNotPaused {
        // specialEventMintPaused is set by owner calling pauseSpecialEventMint and unpauseSpecialEventMint
        require(!specialEventMintPaused, "mint paused");
        require(isAddressWhitelistedForSpecialEvent(proof, msg.sender), "not eligible");

        // verify that the client sent enough eth to pay for the mint
        uint remainder = msg.value % publicMintPrice;
        require(remainder == 0, "send a divisible amount of eth");

        // calculate the amount of tokens we are minting based on the amount of eth sent
        uint amount = msg.value / publicMintPrice;
        require(amount > 0, "amount to mint is 0");

        require(specialMintTokens[msg.sender] < maxItemsForSpecialMint, "already minted max");
        require(specialMintTokens[msg.sender] + amount < maxItemsForSpecialMint, "will surpass special mint cap");

        _mintWithoutValidation(msg.sender, currentOtherTokenId, amount);
        currentOtherTokenId += amount;
    }
    /*
    SPECIAL EVENT MINT FUNCTIONS - END
    */

    /*
    PUBLIC MINT FUNCTIONS - START
    */
    function setPublicMintInfo(bool _publicMintPaused, bool _onlyWhitelistedCanMint, bytes32 _whitelistMerkleRoot) public onlyOwner {
        publicMintPaused = _publicMintPaused;
        whitelistMerkleRoot = _whitelistMerkleRoot;
        onlyWhitelistedCanMint = _onlyWhitelistedCanMint;
    }

    function isAddressWhitelisted(bytes32[] memory proof, address _address) public view returns (bool) {
        return isAddressInMerkleRoot(whitelistMerkleRoot, proof, _address);
    }

    function publicMint(bytes32[] memory proof) external payable whenNotPaused {
        // publicMintPaused is set by owner calling pausePublicMint and unpausePublicMint
        require(!publicMintPaused, "mint paused");
        // verify that the client sent enough eth to pay for the mint
        uint remainder = msg.value % publicMintPrice;
        require(remainder == 0, "send a divisible amount of eth");

        // calculate the amount of tokens we are minting based on the amount of eth sent
        uint amount = msg.value / publicMintPrice;

        require(amount <= maxItemsPerTx, "max 5 per tx");

        // onlyWhitelistedCanMint is set by calling setOnlyWhitelistedCanMint
        if (onlyWhitelistedCanMint){
            uint numGen1sOwned = numGeneration1sOwned();
            uint numGen2sOwned = numGeneration2sOwned();
            // perform the following only for wallets that don't have a gen 1 or gen 2
            if (numGen1sOwned == 0 && numGen2sOwned == 0) {
                // should not throw if user is whitelisted, the amount being minted is equal to their whitelisted value and they
                // have not minted already.
                require(isAddressWhitelisted(proof, msg.sender), "not eligible to mint");
            }
        }

        _mintWithoutValidation(msg.sender, currentOtherTokenId, amount);
        currentOtherTokenId += amount;
    }
    /*
    PUBLIC MINT FUNCTIONS - END
    */

    /*
    HELPER FUNCTIONS - START
    */
    function _mintWithoutValidation(address to, uint startTokenId, uint amount) internal {
        require((totalSupply + amount) <= collectionSize, "sold out");
        for (uint i = 0; i < amount; i++) {
            totalSupply += 1;
            _mint(to, startTokenId + i);
            emit Mint(to, startTokenId + i);
        }
    }

    function calculateRareMintAmount(uint numGen1sOwned, uint numGen2sOwned) internal view returns (uint){
        if (numGen1sOwned > 0 && numGen2sOwned > 0){
            // the number of rares minted should be the lesser of gen 1s owned to gen 2s owned
            uint amount = numGen1sOwned;
            if (numGen1sOwned > numGen2sOwned) {
                amount = numGen2sOwned;
            }
            return amount - ownerRareTokens[msg.sender];
        }
        return 0;
    }

    function numGeneration1sOwned() public view returns (uint256) {
        return gen1ContractInstance.balanceOf(msg.sender);
    }

    function numGeneration2sOwned() public view returns (uint256) {
        return gen2ContractInstance.balanceOf(msg.sender);
    }

    function isAddressInMerkleRoot(bytes32 merkleRoot, bytes32[] memory proof, address _address) internal pure returns (bool) {
        // specialEventWhitelistMerkleRoot is set by calling setSpecialEventWhitelistMerkleRoot
        return proof.verify(merkleRoot, keccak256(abi.encodePacked(_address)));
    }
    /*
    HELPER FUNCTIONS - END
    */

    /*
    ADMIN FUNCTIONS - BEGIN
    */
    function setGeneration1ContractAddress(address _gen1ContractAddress) public onlyOwner {
        require(_gen1ContractAddress.isContract(), "invalid contract address");
        gen1ContractInstance = Generation1s(_gen1ContractAddress);
    }

    function setGeneration2ContractAddress(address _gen2ContractAddress) public onlyOwner {
        require(_gen2ContractAddress.isContract(), "invalid contract address");
        gen2ContractInstance = Generation2s(_gen2ContractAddress);
    }

    function setMintInfo(uint _preMintPrice, uint _publicMintPrice) public onlyOwner {
        preMintPrice = _preMintPrice;
        publicMintPrice = _publicMintPrice;
    }

    function setCollectionSize(uint _collectionSize) public onlyOwner {
        collectionSize = _collectionSize;
    }

    function setMaxItemsPerTrx(uint _maxItemsPerTrx) public onlyOwner {
        maxItemsPerTx = _maxItemsPerTrx;
    }

    function setBaseTokenURI(string memory _baseTokenURI) external onlyOwner {
        baseTokenURI = _baseTokenURI;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function withdrawAll() external onlyOwner {
        //        uint amount1 = address(this).balance * 825 / 1000;
        //        uint amount2 = address(this).balance * 175 / 1000;
        //        sendEth(0xD457adC3B0C658063e2e445b0ab07D2110e715e1, amount1);
        //        sendEth(0xf415770F7aF765f823296BA7294c6d72217C8Af5, amount2);

        sendEth(msg.sender, address(this).balance);
    }

    function sendEth(address to, uint amount) internal {
        (bool success,) = to.call{value: amount}("");
        require(success, "Failed to send ether");
    }
    /*
    ADMIN FUNCTIONS - END
    */

    /*
    REQUIRED BY SOLIDITY - START
    */
    function _burn(uint256 tokenId) internal override(ERC721) {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override(ERC721) returns (string memory) {
        return string(abi.encodePacked(baseTokenURI, Strings.toString(tokenId)));
    }
    /*
    REQUIRED BY SOLIDITY - END
    */
}