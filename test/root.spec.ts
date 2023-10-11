import { ComposeClient } from '@composedb/client'
import { definition } from '@/src/__generated__/definition'
import { RuntimeCompositeDefinition } from '@composedb/types'
import { test, describe, beforeAll, expect } from 'vitest'
import {
  mutationCreateAttestation, mutationCreateClaim, mutationCreateProfile,
  mutationCreateResearchObject, mutationUpdateAttestation, mutationUpdateResearchObject, queryResearchObjects
} from '../utils/queries'
import { randomDID } from './util'
import { CeramicClient } from '@ceramicnetwork/http-client'
import { writeComposite } from 'scripts/composites.mjs'
import { setTimeout } from "timers/promises";

const CERAMIC_API = 'http:/localhost:7007'
const TIMEOUT = 7000
const A_CID = 'bafybeibeaampol2yz5xuoxex7dxri6ztqveqrybzfh5obz6jrul5gb4cf4'

const ceramic = new CeramicClient(CERAMIC_API)

describe('ComposeDB nodes', () => {
  beforeAll(async () => {
    try {
      await fetch(`${CERAMIC_API}/api/v0`)
    } catch (e) {
      console.error('Failed connection to Ceramic. Run with "make test" or against live devserver!')
      process.exit(1)
    };

    // Takes a spinner param which just screws with our test output
    await writeComposite({ info: () => { }, succeed: () => { } });
  });

  describe('User', async () => {
    const composeClient = freshClient();
    const user = await randomDID();
    composeClient.setDID(user);

    // Create mutations error on failure and are otherwise successful
    test('can create research object', async () => {
      mutationCreateResearchObject(
        composeClient,
        {
          title: 'Test',
          manifest: A_CID
        }
      );
    });

    test('can create profile', async () =>
      await mutationCreateProfile(
        composeClient,
        {
          displayName: 'First Lastname',
          orcid: 'orcidHandle'
        }
      ),
      // SINGLE accountRelation instances will ask the network for previous
      // creations, which slowly times out. PR allowing setting this timeout
      // in progress: https://github.com/ceramicstudio/js-composedb/pull/182
      TIMEOUT
    );

    test('can create claim', async () =>
      await mutationCreateClaim(
        composeClient,
        {
          title: 'My Claim',
          description: 'The point of the claim',
          badge: A_CID
        }
      )
    );

    test('can attest to own research object', async () => {
      const myResearchObject = await mutationCreateResearchObject(
        composeClient,
        {
          title: 'Test',
          manifest: A_CID
        }
      );
      const myClaim = await mutationCreateClaim(
        composeClient,
        {
          title: 'My Claim',
          description: 'The point of the claim',
          badge: A_CID
        }
      );
      await mutationCreateAttestation(
        composeClient,
        {
          targetID: myResearchObject.streamID,
          targetVersion: myResearchObject.commitID,
          claimID: myClaim.streamID,
          claimVersion: myClaim.commitID,
          revoked: false
        }
      );
    });
  });

  describe('Attestations', async () => {
    const composeClient = freshClient()
    composeClient.setDID(await randomDID())
    const testClaim = await mutationCreateClaim(
      composeClient,
      {
        title: 'Test',
        description: 'A nice explanation'
      }
    );

    test('can be made to own profile', async () => {
      const user = await randomDID();
      composeClient.setDID(user);

      const ownProfile = await mutationCreateProfile(
        composeClient,
        {
          displayName: 'First Lastname',
          orcid: 'orcidHandle'
        }
      );

      await mutationCreateAttestation(
        composeClient,
        {
          targetID: ownProfile.streamID,
          targetVersion: ownProfile.commitID,
          claimID: testClaim.streamID,
          claimVersion: testClaim.commitID,
          revoked: false
        }
      );
    })

    test('can be made to other users research object', async () => {
      const user1 = await randomDID();
      composeClient.setDID(user1);
      const user1ResearchObject = await mutationCreateResearchObject(
        composeClient,
        {
          title: 'Paper',
          manifest: A_CID
        }
      );

      const user2 = await randomDID();
      composeClient.setDID(user2);
      await mutationCreateAttestation(
        composeClient,
        {
          targetID: user1ResearchObject.streamID,
          targetVersion: user1ResearchObject.commitID,
          claimID: testClaim.streamID,
          claimVersion: testClaim.commitID,
          revoked: false
        }
      );
    })

    test('can be updated with revokation', async () => {
      const user = await randomDID();
      composeClient.setDID(user);
      const researchObject = await mutationCreateResearchObject(
        composeClient,
        {
          title: 'Paper',
          manifest: A_CID
        }
      );

      const attestation = await mutationCreateAttestation(
        composeClient,
        {
          targetID: researchObject.streamID,
          targetVersion: researchObject.commitID,
          claimID: testClaim.streamID,
          claimVersion: testClaim.commitID,
          revoked: false
        }
      );

      await mutationUpdateAttestation(
        composeClient,
        {
          id: attestation.streamID,
          revoked: true
        }
      );
    })
  })

  describe.skip('Annotations', async () => {
    test('can comment on research component', async () => { });

    test('can comment on research object', async () => { });

    test('can suggest metadata change on research component', async () => { });

    test('can suggest metadata changes on research object', async () => { });
  });

  describe('User', async () => {
    const composeClient = freshClient();
    const user = await randomDID();
    composeClient.setDID(user);

    test('can update research object', async () => {
      const researchObject = await mutationCreateResearchObject(
        composeClient,
        {
          title: 'Test',
          manifest: A_CID
        }
      );
      await mutationUpdateResearchObject(
        composeClient,
        {
          id: researchObject.streamID,
          title: 'A fancy new title',
          manifest: "bafkreibtsll3aq2bynvlxnqh6nxafzdm4cpiovr3bcncbkzjcy32xaaaaa"
        }
      );
    });

    test('can update profile', async () => {
      await mutationCreateProfile(
        composeClient,
        {
          displayName: "My Name",
          orcid: "@handle"
        }
      );

      // Ceramic node takes a little while syncing this with the "network"
      // since it has the SINGLE accountRelation
      await setTimeout(500);
      // Apparently create acts as an upsert on SINGLE accountRelation models
      await mutationCreateProfile(
        composeClient,
        {
          displayName: "New Name",
          orcid: "@handle"
        }
      );
    }, TIMEOUT);

  });

  describe('System', async () => {
    const composeClient = freshClient();
    const user = await randomDID();
    composeClient.setDID(user);

    test('can get commits anchored before a certain time', async () => {
      // This assumes anchors have been made, which is very fast running locally
      // but are made in longer time periods with on-chain anchoring

      const { streamID } = await mutationCreateResearchObject(
        composeClient,
        {
          title: 'Old',
          manifest: A_CID
        }
      );
      const timeBetween = Date.now();
      await setTimeout(1000)
      await mutationUpdateResearchObject(
        composeClient,
        {
          id: streamID,
          title: 'New'
        }
      );

      const stream = await ceramic.loadStream(streamID);
      expect(stream.state.content.title).toEqual('New');

      const streamBetween = await ceramic.loadStream(streamID, { atTime: timeBetween });
      expect(streamBetween.state.content.title).toEqual('Old');
    });
  });


})

const freshClient = () =>
  new ComposeClient({ ceramic, definition: definition as RuntimeCompositeDefinition })
