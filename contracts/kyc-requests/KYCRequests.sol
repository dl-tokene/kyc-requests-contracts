// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {AbstractDependant} from "@solarity/solidity-lib/contracts-registry/AbstractDependant.sol";
import {TypeCaster} from "@solarity/solidity-lib/libs/utils/TypeCaster.sol";

import {MasterContractsRegistry} from "@tokene/core-contracts/core/MasterContractsRegistry.sol";
import {MasterAccessManagement} from "@tokene/core-contracts/core/MasterAccessManagement.sol";
import {IReviewableRequests, ReviewableRequests} from "@tokene/core-contracts/core/ReviewableRequests.sol";

import {IKYCRequests} from "../interfaces/IKYCRequests.sol";

/**
 * @notice The KYCRequests contract that enables KYC reviewable requests. The contract integrates with the
 * core ReviewableRequest contract to issue KYC requests. The use is able to drop the request at any time
 */
contract KYCRequests is IKYCRequests, AbstractDependant, Initializable {
    using Strings for uint256;

    string public constant UPDATE_PERMISSION = "UPDATE";

    string public constant KYC_REQUESTS_RESOURCE = "KYC_REQUESTS_RESOURCE";

    string public constant KYC_REQUESTS_DEP = "KYC_REQUESTS";

    string public KYCRole;

    MasterAccessManagement internal _masterAccess;
    ReviewableRequests internal _reviewableRequests;

    mapping(address => UserRequestInfo) internal _usersRequestInfo;

    modifier onlyUpdatePermission() {
        require(
            _masterAccess.hasPermission(msg.sender, KYC_REQUESTS_RESOURCE, UPDATE_PERMISSION),
            "KYCRequests: access denied"
        );
        _;
    }

    /**
     * @notice The initializer function
     * @param KYCRole_ the name of the KYC role
     */
    function __KYCRequests_init(string calldata KYCRole_) external initializer {
        _updateKYCRole(KYCRole_);
    }

    /**
     * @notice The function to set dependencies
     * @dev Access: the injector address
     * @param registryAddress_ the ContractsRegistry address
     */
    function setDependencies(address registryAddress_, bytes memory) public override dependant {
        MasterContractsRegistry registry_ = MasterContractsRegistry(registryAddress_);

        _masterAccess = MasterAccessManagement(registry_.getMasterAccessManagement());
        _reviewableRequests = ReviewableRequests(registry_.getReviewableRequests());
    }

    /**
     * @inheritdoc IKYCRequests
     */
    function updateKYCRole(string calldata newKYCRole_) external onlyUpdatePermission {
        _updateKYCRole(newKYCRole_);
    }

    /**
     * @inheritdoc IKYCRequests
     */
    function requestKYC(string calldata KYCHash_) external override {
        UserRequestInfo storage requestInfo = _usersRequestInfo[msg.sender];

        if (requestInfo.existingRequest) {
            require(
                !_isPendingReqest(requestInfo.requestId),
                "KYCRequests: user has a pending request"
            );
        } else {
            requestInfo.existingRequest = true;
        }

        uint256 newRequestId_ = _reviewableRequests.nextRequestId();

        bytes memory acceptData_ = abi.encodeWithSelector(
            _masterAccess.grantRoles.selector,
            msg.sender,
            TypeCaster.asSingletonArray(KYCRole)
        );
        string memory misc_ = uint256(uint160(msg.sender)).toHexString(20);

        _reviewableRequests.createRequest(
            address(_masterAccess),
            acceptData_,
            "",
            misc_,
            KYCHash_
        );

        requestInfo.requestId = newRequestId_;

        emit KYCRoleRequested(msg.sender, newRequestId_);
    }

    /**
     * @inheritdoc IKYCRequests
     */
    function dropKYCRequest() external {
        UserRequestInfo memory requestInfo_ = _usersRequestInfo[msg.sender];

        require(requestInfo_.existingRequest, "KYCRequests: user has no requests");
        require(
            _isPendingReqest(requestInfo_.requestId),
            "KYCRequests: user has no pending requests"
        );

        _reviewableRequests.dropRequest(requestInfo_.requestId);

        emit KYCRequestDropped(msg.sender, requestInfo_.requestId);
    }

    /**
     * @inheritdoc IKYCRequests
     */
    function getUserRequestInfo(
        address user_
    ) external view override returns (UserRequestInfo memory) {
        return _usersRequestInfo[user_];
    }

    /**
     * @notice The internal function to update the KYC role
     */
    function _updateKYCRole(string calldata newKYCRole_) internal {
        require(bytes(newKYCRole_).length > 0, "KYCRequests: empty KYC role");

        KYCRole = newKYCRole_;

        emit KYCRoleUpdated(newKYCRole_);
    }

    /**
     * @notice The internal function check if request is pending
     */
    function _isPendingReqest(uint256 requestId_) internal view returns (bool) {
        (IReviewableRequests.RequestStatus requestStatus_, , , , , ) = _reviewableRequests
            .requests(requestId_);

        return requestStatus_ == IReviewableRequests.RequestStatus.PENDING;
    }
}
