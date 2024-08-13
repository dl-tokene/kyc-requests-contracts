import { Deployer } from "@solarity/hardhat-migrate";

import { IRBAC, MasterAccessManagement__factory, MasterContractsRegistry__factory } from "@/generated-types/ethers";

import { getConfigJson } from "./config/config-parser";

import {
  RBAC_CREATOR,
  REVIEWABLE_REQUESTS_CREATOR,
  REVIEWABLE_REQUESTS_REMOVER,
  RBAC_RESOURCE,
  REVIEWABLE_REQUESTS_RESOURCE,
  CREATE_PERMISSION,
  DELETE_PERMISSION,
  KYC_REQUESTS_DEP,
} from "./utils/constants";

export = async (deployer: Deployer) => {
  const config = await getConfigJson();

  const registry = await deployer.deployed(MasterContractsRegistry__factory, config.addresses.MasterContractsRegistry);

  const masterAccess = await deployer.deployed(
    MasterAccessManagement__factory,
    await registry.getMasterAccessManagement(),
  );

  const reviewableRequestsAddress = await registry.getReviewableRequests();
  const kycRequestsAddress = await registry.getContract(KYC_REQUESTS_DEP);

  const RBACCreate: IRBAC.ResourceWithPermissionsStruct = {
    resource: RBAC_RESOURCE,
    permissions: [CREATE_PERMISSION],
  };
  const ReviewableRequestsCreate: IRBAC.ResourceWithPermissionsStruct = {
    resource: REVIEWABLE_REQUESTS_RESOURCE,
    permissions: [CREATE_PERMISSION],
  };
  const ReviewableRequestsDelete: IRBAC.ResourceWithPermissionsStruct = {
    resource: REVIEWABLE_REQUESTS_RESOURCE,
    permissions: [DELETE_PERMISSION],
  };

  await masterAccess.addPermissionsToRole(RBAC_CREATOR, [RBACCreate], true);
  await masterAccess.addPermissionsToRole(REVIEWABLE_REQUESTS_CREATOR, [ReviewableRequestsCreate], true);
  await masterAccess.addPermissionsToRole(REVIEWABLE_REQUESTS_REMOVER, [ReviewableRequestsDelete], true);

  await masterAccess.grantRoles(reviewableRequestsAddress, [RBAC_CREATOR]);
  await masterAccess.grantRoles(kycRequestsAddress, [REVIEWABLE_REQUESTS_CREATOR, REVIEWABLE_REQUESTS_REMOVER]);
};
