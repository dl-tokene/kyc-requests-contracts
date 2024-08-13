// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IKYCRequests {
    struct UserRequestInfo {
        uint256 requestId;
        bool existingRequest;
    }

    /**
     * @notice This event is emitted when the KYC role is updated
     * @param newKYCRole the new KYC role
     */
    event KYCRoleUpdated(string newKYCRole);

    /**
     * @notice This event is emitted when a KYC role is requested
     * @param userAddr the address of the user who requested the role
     * @param requestId the request identifier
     */
    event KYCRoleRequested(address userAddr, uint256 requestId);

    /**
     * @notice This event is emitted when a user drops a role request
     * @param userAddr the address of the user who dropped the request
     * @param requestId the dropped request identifier
     */
    event KYCRequestDropped(address userAddr, uint256 requestId);

    /**
     * @notice The function to update the KYC role
     * @dev Access: UPDATE permission
     * @param newKYCRole_ the new KYC role string
     */
    function updateKYCRole(string calldata newKYCRole_) external;

    /**
     * @notice The function for creating a request for KYC role
     * @dev Access: any, one request per user
     * @param KYCHash_ the string with information about user's KYC (probably file hash from IPFS)
     */
    function requestKYC(string calldata KYCHash_) external;

    /**
     * @notice The function to cancel the request for KYC role
     * @dev Access: any, the request creator
     */
    function dropKYCRequest() external;

    /**
     * @notice The function for getting information about a request for a specific user
     * @param user_ the address of the user for whom you want to get information
     * @return user request information
     */
    function getUserRequestInfo(address user_) external view returns (UserRequestInfo memory);
}
