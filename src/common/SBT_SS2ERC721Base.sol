// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;

import {ERC721, ERC721TokenReceiver} from "solmate/tokens/ERC721.sol";

abstract contract SBT_SS2ERC721Base is ERC721 {
    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 internal constant WORD_SIZE = 32;
    uint256 internal constant ADDRESS_SIZE_BYTES = 20;
    uint256 internal constant ADDRESS_OFFSET_BITS = 96;
    uint256 internal constant FREE_MEM_PTR = 0x40;
    uint256 internal constant SSTORE2_DATA_OFFSET = 1;
    uint256 internal constant ERROR_STRING_SELECTOR = 0x08c379a0; // Error(string)
    uint256 internal constant SSTORE2_CREATION_CODE_PREFIX = 0x600B5981380380925939F3; // see SSTORE2.sol
    uint256 internal constant SSTORE2_CREATION_CODE_OFFSET = 12; // prefix length + 1 for a 0 byte

    // The `Transfer` event signature is given by:
    // `keccak256(bytes("Transfer(address,address,uint256)"))`.
    bytes32 internal constant TRANSFER_EVENT_SIGNATURE =
        0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;

    // The mask of the lower 160 bits for addresses.
    uint256 internal constant BITMASK_ADDRESS = (1 << 160) - 1;

    /*//////////////////////////////////////////////////////////////
                             VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// implementations must override this function to return the number of tokens minted
    function _ownersPrimaryLength() internal view virtual returns (uint256);

    /// implementations must override this function to return the primary owner of a token
    /// or address(0) if the token does not exist
    function _ownerOfPrimary(uint256 id) internal view virtual returns (address owner);

    /// @dev performs no bounds check, just a raw extcodecopy on the pointer
    /// @return addr the address at the given pointer (may include 0 bytes if reading past the end of the pointer)
    function SSTORE2_readRawAddress(address pointer, uint256 start) internal view returns (address addr) {
        // we're going to read 20 bytes from the pointer in the first scratch space slot
        uint256 dest_offset = 12;

        assembly {
            start := add(start, 1) // add the SSTORE2 DATA_OFFSET

            // clear it the first scratch space slot
            mstore(0, 0)

            extcodecopy(pointer, dest_offset, start, 20)

            addr := mload(0)
        }
    }

    // binary search of the address based on _ownerOfPrimary
    // performs O(log n) sloads
    // relies on the assumption that the list of addresses is sorted and contains no duplicates
    // returns 1 if the address is found in _ownersPrimary, 0 if not
    function _balanceOfPrimary(address owner) internal view returns (uint256) {
        uint256 low = 1;
        uint256 high = _ownersPrimaryLength();
        uint256 mid = (low + high) / 2;

        // TODO: unchecked
        while (low <= high) {
            address midOwner = _ownerOfPrimary(mid);
            if (midOwner == owner) {
                return 1;
            } else if (midOwner < owner) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
            mid = (low + high) / 2;
        }

        return 0;
    }

    function ownerOf(uint256 id) public view virtual override returns (address owner) {
        owner = _ownerOfPrimary(id);
        require(owner != address(0), "NOT_MINTED");
    }

    function balanceOf(address owner) public view virtual override returns (uint256 balance) {
        require(owner != address(0), "ZERO_ADDRESS");

        balance = _balanceOfPrimary(owner);
    }

    /*//////////////////////////////////////////////////////////////
                              ERC721 LOGIC
    //////////////////////////////////////////////////////////////*/

    function approve(address spender, uint256 id) public virtual override {
        // need to use the ownerOf getter here instead of directly accessing the storage
        address owner = _ownerOfPrimary(id);

        require(msg.sender == owner || isApprovedForAll[owner][msg.sender], "NOT_AUTHORIZED");

        getApproved[id] = spender;

        emit Approval(owner, spender, id);
    }

    function transferFrom(address, address, uint256) public virtual override {
        require(false, "NOT_AUTHORIZED");
    }

    /// @dev needs to be overridden here to invoke our custom version of transferFrom
    function safeTransferFrom(address from, address to, uint256 id) public virtual override {
        transferFrom(from, to, id);
    }

    /// @dev needs to be overridden here to invoke our custom version of transferFrom
    function safeTransferFrom(address from, address to, uint256 id, bytes calldata) public virtual override {
        transferFrom(from, to, id);
    }

    /*//////////////////////////////////////////////////////////////
                        INTERNAL SAFE MINT LOGIC
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Internal function to invoke {IERC721Receiver-onERC721Received} on a target address.
     * The call is not executed if the target address is not a contract.
     *
     * @param from address representing the previous owner of the given token ID
     * @param to target address that will receive the tokens
     * @param tokenId uint256 ID of the token to be transferred
     * @param data bytes optional data to send along with the call
     * @return bool whether the call correctly returned the expected magic value
     */
    function _checkOnERC721Received(address from, address to, uint256 tokenId, bytes memory data)
        internal
        returns (bool)
    {
        if (to.code.length == 0) {
            return true;
        }

        try ERC721TokenReceiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
            return retval == ERC721TokenReceiver.onERC721Received.selector;
        } catch (bytes memory reason) {
            if (reason.length == 0) {
                revert("UNSAFE_RECIPIENT");
            } else {
                /// @solidity memory-safe-assembly
                assembly {
                    revert(add(32, reason), mload(reason))
                }
            }
        }
    }
}
