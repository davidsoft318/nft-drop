// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Chibis is ERC721Enumerable, Ownable {

    uint public _maxItems = 200;
    uint public _totalSupply = 0;

    string public _baseTokenURI;

    event Mint(address indexed owner, uint indexed tokenId);

    constructor() ERC721("Chibi", "CHIBI") {}

    function mint(address to) public onlyOwner {
        require(_totalSupply + 1 <= _maxItems, "mint: Surpasses cap");
        _totalSupply += 1;
        _mint(to, _totalSupply);
        emit Mint(to, _totalSupply);
    }

    function setBaseURI(string memory __baseTokenURI) public onlyOwner {
        _baseTokenURI = __baseTokenURI;
    }

    function baseURI() public view returns (string memory) {
        return _baseTokenURI;
    }
    
    // The following functions are overrides required by Solidity.
    /**
      * @dev Returns a URI for a given token ID's metadata
      */
    function tokenURI(uint256 _tokenId) public view override(ERC721) returns (string memory) {
        return string(abi.encodePacked(baseURI(), Strings.toString(_tokenId)));
    }
}
