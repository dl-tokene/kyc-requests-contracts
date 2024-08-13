import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

import { Reverter } from "@/test/helpers/reverter";

import {
  CREATE_PERMISSION,
  DELETE_PERMISSION,
  UPDATE_PERMISSION,
  RBAC_RESOURCE,
  REVIEWABLE_REQUESTS_RESOURCE,
  KYC_REQUESTS_RESOURCE,
  KYC_REQUESTS_DEP,
  RequestStatus,
} from "../utils/constants";

import { MasterContractsRegistry, MasterAccessManagement, ReviewableRequests, KYCRequests, IRBAC } from "@ethers-v6";

describe("KYCRequests", async () => {
  const reverter = new Reverter();

  let OWNER: SignerWithAddress;
  let USER1: SignerWithAddress;
  let USER2: SignerWithAddress;

  const ReviewableRequestsRole = "RR";
  const ReviewableRequestsRBACRole = "RRRBACR";
  const KYCRequestsUpdateRole = "KYCU";

  const KYCRole = "KYCR";

  const FIRST_REQUEST_ID = 0;

  const ReviewableRequestsCreate: IRBAC.ResourceWithPermissionsStruct = {
    resource: REVIEWABLE_REQUESTS_RESOURCE,
    permissions: [CREATE_PERMISSION, DELETE_PERMISSION],
  };
  const ReviewableRequestsRBACCreate: IRBAC.ResourceWithPermissionsStruct = {
    resource: RBAC_RESOURCE,
    permissions: [CREATE_PERMISSION],
  };
  const KYCRequestsUpdate: IRBAC.ResourceWithPermissionsStruct = {
    resource: KYC_REQUESTS_RESOURCE,
    permissions: [UPDATE_PERMISSION],
  };

  let registry: MasterContractsRegistry;
  let masterAccess: MasterAccessManagement;
  let reviewableRequests: ReviewableRequests;
  let kycRequests: KYCRequests;

  before("setup", async () => {
    [OWNER, USER1, USER2] = await ethers.getSigners();

    const MasterContractsRegistry = await ethers.getContractFactory("MasterContractsRegistry");
    registry = await MasterContractsRegistry.deploy();

    const MasterAccessManagement = await ethers.getContractFactory("MasterAccessManagement");
    const _masterAccess = await MasterAccessManagement.deploy();

    const ReviewableRequests = await ethers.getContractFactory("ReviewableRequests");
    const _reviewableRequests = await ReviewableRequests.deploy();

    const KYCRequests = await ethers.getContractFactory("KYCRequests");
    const _kycRequests = await KYCRequests.deploy();

    await registry.__MasterContractsRegistry_init(await _masterAccess.getAddress());

    masterAccess = MasterAccessManagement.attach(await registry.getMasterAccessManagement()) as MasterAccessManagement;
    await masterAccess.__MasterAccessManagement_init(OWNER);

    await registry.addProxyContract(await registry.REVIEWABLE_REQUESTS_NAME(), await _reviewableRequests.getAddress());
    await registry.addProxyContract(KYC_REQUESTS_DEP, await _kycRequests.getAddress());

    reviewableRequests = ReviewableRequests.attach(await registry.getReviewableRequests()) as ReviewableRequests;
    kycRequests = KYCRequests.attach(await registry.getContract(KYC_REQUESTS_DEP)) as KYCRequests;

    await kycRequests.__KYCRequests_init(KYCRole);

    await registry.injectDependencies(await registry.REVIEWABLE_REQUESTS_NAME());
    await registry.injectDependencies(KYC_REQUESTS_DEP);

    await masterAccess.addPermissionsToRole(ReviewableRequestsRBACRole, [ReviewableRequestsRBACCreate], true);
    await masterAccess.grantRoles(await reviewableRequests.getAddress(), [ReviewableRequestsRBACRole]);

    await masterAccess.addPermissionsToRole(ReviewableRequestsRole, [ReviewableRequestsCreate], true);
    await masterAccess.grantRoles(await kycRequests.getAddress(), [ReviewableRequestsRole]);

    await masterAccess.addPermissionsToRole(KYCRequestsUpdateRole, [KYCRequestsUpdate], true);
    await masterAccess.grantRoles(USER1, [KYCRequestsUpdateRole]);

    await reverter.snapshot();
  });

  afterEach("revert", reverter.revert);

  describe("creation", () => {
    it("should get exception if try to call init function twice", async () => {
      const reason = "Initializable: contract is already initialized";

      await expect(kycRequests.__KYCRequests_init(KYCRole)).to.be.rejectedWith(reason);
    });

    it("should get exception if pass empty KYC role string", async () => {
      const KYCRequests = await ethers.getContractFactory("KYCRequests");
      const _kycRequests = await KYCRequests.deploy();
      const reason = "KYCRequests: empty KYC role";

      await expect(_kycRequests.__KYCRequests_init("")).to.be.rejectedWith(reason);
    });

    it("should get exception if not an injector try to call set dependencies function", async () => {
      const reason = "Dependant: not an injector";

      await expect(kycRequests.connect(USER1).setDependencies(await registry.getAddress(), "0x")).to.be.rejectedWith(
        reason,
      );
    });
  });

  describe("updateKYCRole", () => {
    const newKYCRole = "new KYC role";

    it("should correctly update KYC role", async () => {
      await expect(kycRequests.connect(USER1).updateKYCRole(newKYCRole))
        .to.emit(kycRequests, "KYCRoleUpdated")
        .withArgs(newKYCRole);
      expect(await kycRequests.KYCRole()).to.be.equal(newKYCRole);
    });

    it("should get exception if user without permission try to call this function", async () => {
      const reason = "KYCRequests: access denied";

      await expect(kycRequests.connect(USER2).updateKYCRole(newKYCRole)).to.be.rejectedWith(reason);
    });
  });

  describe("requestKYC", () => {
    const kycHash = "some hash";

    it("should correctly request KYC role", async () => {
      let userRequestInfo = await kycRequests.getUserRequestInfo(USER1);

      expect(userRequestInfo.requestId).to.be.equal(FIRST_REQUEST_ID);
      expect(userRequestInfo.existingRequest).to.be.equal(false);

      await expect(kycRequests.connect(USER1).requestKYC(kycHash))
        .to.emit(kycRequests, "KYCRoleRequested")
        .withArgs(USER1.address, FIRST_REQUEST_ID);

      userRequestInfo = await kycRequests.getUserRequestInfo(USER1);

      expect(userRequestInfo.requestId).to.be.equal(FIRST_REQUEST_ID);
      expect(userRequestInfo.existingRequest).to.be.equal(true);
    });

    it("should correctly accept request and grant role", async () => {
      await kycRequests.connect(USER1).requestKYC(kycHash);

      const request = await reviewableRequests.requests(FIRST_REQUEST_ID);

      expect(request.misc).to.be.equal(USER1.address.toLowerCase());

      await reviewableRequests.acceptRequest(FIRST_REQUEST_ID);

      expect((await reviewableRequests.requests(FIRST_REQUEST_ID)).status).to.be.equal(RequestStatus.ACCEPTED);
      expect(await masterAccess.getUserRoles(USER1)).to.deep.equal([KYCRequestsUpdateRole, KYCRole]);
    });

    it("should correctly create request after accepted, rejected or dropped request", async () => {
      await kycRequests.connect(USER1).requestKYC(kycHash);

      expect((await reviewableRequests.requests(FIRST_REQUEST_ID)).status).to.be.equal(RequestStatus.PENDING);

      await reviewableRequests.rejectRequest(FIRST_REQUEST_ID, "reason");

      expect((await reviewableRequests.requests(FIRST_REQUEST_ID)).status).to.be.equal(RequestStatus.REJECTED);

      await kycRequests.connect(USER1).requestKYC(kycHash);

      expect((await reviewableRequests.requests(1)).status).to.be.equal(RequestStatus.PENDING);

      await kycRequests.connect(USER1).dropKYCRequest();

      expect((await reviewableRequests.requests(1)).status).to.be.equal(RequestStatus.DROPPED);

      await kycRequests.connect(USER1).requestKYC(kycHash);

      expect((await reviewableRequests.requests(2)).status).to.be.equal(RequestStatus.PENDING);

      await reviewableRequests.acceptRequest(2);

      expect((await reviewableRequests.requests(2)).status).to.be.equal(RequestStatus.ACCEPTED);

      await kycRequests.connect(USER1).requestKYC(kycHash);
    });

    it("should get exception if user has a pending request", async () => {
      const reason = "KYCRequests: user has a pending request";

      await kycRequests.connect(USER1).requestKYC(kycHash);

      await expect(kycRequests.connect(USER1).requestKYC(kycHash)).to.be.rejectedWith(reason);
    });
  });

  describe("dropKYCRequest", () => {
    const kycHash = "some hash";

    it("should correctly drop the KYC request", async () => {
      await kycRequests.connect(USER1).requestKYC(kycHash);

      await expect(kycRequests.connect(USER1).dropKYCRequest())
        .emit(kycRequests, "KYCRequestDropped")
        .withArgs(USER1.address, FIRST_REQUEST_ID);

      expect((await reviewableRequests.requests(FIRST_REQUEST_ID)).status).to.be.equal(RequestStatus.DROPPED);
    });

    it("should get exception if user has no request", async () => {
      const reason = "KYCRequests: user has no requests";

      await expect(kycRequests.connect(USER1).dropKYCRequest()).to.be.rejectedWith(reason);
    });

    it("should get exception if user has no pending request", async () => {
      await kycRequests.connect(USER1).requestKYC(kycHash);
      await reviewableRequests.acceptRequest(FIRST_REQUEST_ID);

      const reason = "KYCRequests: user has no pending requests";

      await expect(kycRequests.connect(USER1).dropKYCRequest()).to.be.rejectedWith(reason);
    });
  });
});
