import { mock, mockDeep, mockReset } from 'jest-mock-extended';
import { nanoid } from 'nanoid';
import { Socket } from 'socket.io';
import * as TestUtils from '../client/TestUtils';
import { UserLocation } from '../CoveyTypes';
import { townSubscriptionHandler } from '../requestHandlers/CoveyTownRequestHandlers';
import CoveyTownListener from '../types/CoveyTownListener';
import Player from '../types/Player';
import PlayerSession from '../types/PlayerSession';
import CoveyTownController from './CoveyTownController';
import CoveyTownsStore from './CoveyTownsStore';
import TwilioVideo from './TwilioVideo';

const mockTwilioVideo = mockDeep<TwilioVideo>();
jest.spyOn(TwilioVideo, 'getInstance').mockReturnValue(mockTwilioVideo);

function generateTestLocation(): UserLocation {
  return {
    rotation: 'back',
    moving: Math.random() < 0.5,
    x: Math.floor(Math.random() * 100),
    y: Math.floor(Math.random() * 100),
  };
}

function followerCount(player: Player) {
  let output = 0;

  let currentPlayer: Player | undefined = player.follower;
  while (currentPlayer) {
    output += 1;
    currentPlayer = currentPlayer.follower;
  }

  return output;
}

describe('CoveyTownController', () => {
  beforeEach(() => {
    mockTwilioVideo.getTokenForTown.mockClear();
  });
  it('constructor should set the friendlyName property', () => {
    const townName = `FriendlyNameTest-${nanoid()}`;
    const townController = new CoveyTownController(townName, false);
    expect(townController.friendlyName).toBe(townName);
  });
  describe('addPlayer', () => {
    it('should use the coveyTownID and player ID properties when requesting a video token', async () => {
      const townName = `FriendlyNameTest-${nanoid()}`;
      const townController = new CoveyTownController(townName, false);
      const newPlayerSession = await townController.addPlayer(new Player(nanoid()));
      expect(mockTwilioVideo.getTokenForTown).toBeCalledTimes(1);
      expect(mockTwilioVideo.getTokenForTown).toBeCalledWith(
        townController.coveyTownID,
        newPlayerSession.player.id,
      );
    });
  });
  describe('town listeners and events', () => {
    let testingTown: CoveyTownController;
    const mockListeners = [
      mock<CoveyTownListener>(),
      mock<CoveyTownListener>(),
      mock<CoveyTownListener>(),
    ];
    beforeEach(() => {
      const townName = `town listeners and events tests ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
      mockListeners.forEach(mockReset);
    });
    it('should notify added listeners of player movement when updatePlayerLocation is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);
      const newLocation = generateTestLocation();
      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.updatePlayerLocation(player, newLocation);
      mockListeners.forEach(listener => expect(listener.onPlayerMoved).toBeCalledWith([player]));
    });
    it('should notify added listeners of player disconnections when destroySession is called', async () => {
      const player = new Player('test player');
      const session = await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.destroySession(session);
      mockListeners.forEach(listener =>
        expect(listener.onPlayerDisconnected).toBeCalledWith(player),
      );
    });
    it('Should notify the listeners of all disconnected players and followers when destroySession is called', async () => {
      const player = new Player('test player');
      const session = await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));

      testingTown.addFollower(player, player.id);
      testingTown.addFollower(player, player.id);
      testingTown.addFollower(player, player.id);

      const currentPlayers = [];
      let currentPlayer: Player | undefined = player;
      while (currentPlayer) {
        currentPlayers.push(currentPlayer);
        currentPlayer = currentPlayer.follower;
      }
      expect(currentPlayers.length).toBe(4);
      expect(testingTown.players).toEqual(currentPlayers);

      testingTown.destroySession(session);
      mockListeners.forEach(listener =>
        expect(listener.onPlayerDisconnected).toHaveBeenCalledTimes(4),
      );
      expect(testingTown.players).toEqual([]);
    });
    it('should notify added listeners of new players when addPlayer is called', async () => {
      mockListeners.forEach(listener => testingTown.addTownListener(listener));

      const player = new Player('test player');
      await testingTown.addPlayer(player);
      mockListeners.forEach(listener => expect(listener.onPlayerJoined).toBeCalledWith(player));
    });
    it('should notify added listeners that the town is destroyed when disconnectAllPlayers is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.disconnectAllPlayers();
      mockListeners.forEach(listener => expect(listener.onTownDestroyed).toBeCalled());
    });
    it('should not notify removed listeners of player movement when updatePlayerLocation is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const newLocation = generateTestLocation();
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.updatePlayerLocation(player, newLocation);
      expect(listenerRemoved.onPlayerMoved).not.toBeCalled();
    });
    it('should not notify removed listeners of player disconnections when destroySession is called', async () => {
      const player = new Player('test player');
      const session = await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.destroySession(session);
      expect(listenerRemoved.onPlayerDisconnected).not.toBeCalled();
    });
    it('should not notify removed listeners of new players when addPlayer is called', async () => {
      const player = new Player('test player');

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      const session = await testingTown.addPlayer(player);
      testingTown.destroySession(session);
      expect(listenerRemoved.onPlayerJoined).not.toBeCalled();
    });

    it('should not notify removed listeners that the town is destroyed when disconnectAllPlayers is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.disconnectAllPlayers();
      expect(listenerRemoved.onTownDestroyed).not.toBeCalled();
    });
  });
  describe('townSubscriptionHandler', () => {
    const mockSocket = mock<Socket>();
    let testingTown: CoveyTownController;
    let player: Player;
    let session: PlayerSession;
    beforeEach(async () => {
      const townName = `connectPlayerSocket tests ${nanoid()}`;
      testingTown = CoveyTownsStore.getInstance().createTown(townName, false);
      mockReset(mockSocket);
      player = new Player('test player');
      session = await testingTown.addPlayer(player);
    });
    it('should reject connections with invalid town IDs by calling disconnect', async () => {
      TestUtils.setSessionTokenAndTownID(nanoid(), session.sessionToken, mockSocket);
      townSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toBeCalledWith(true);
    });
    it('should reject connections with invalid session tokens by calling disconnect', async () => {
      TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, nanoid(), mockSocket);
      townSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toBeCalledWith(true);
    });
    describe('with a valid session token', () => {
      it('should add a town listener, which should emit "newPlayer" to the socket when a player joins', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        await testingTown.addPlayer(player);
        expect(mockSocket.emit).toBeCalledWith('newPlayer', player);
      });
      it('should add a town listener, which should emit "playerMoved" to the socket when a player moves', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        testingTown.updatePlayerLocation(player, generateTestLocation());
        expect(mockSocket.emit).toBeCalledWith('playerMoved', [player]);
      });
      it('should add a town listener, which should emit "playerDisconnect" to the socket when a player disconnects', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        testingTown.destroySession(session);
        expect(mockSocket.emit).toBeCalledWith('playerDisconnect', player);
      });
      it('should add a town listener, which should emit "townClosing" to the socket and disconnect it when disconnectAllPlayers is called', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        testingTown.disconnectAllPlayers();
        expect(mockSocket.emit).toBeCalledWith('townClosing');
        expect(mockSocket.disconnect).toBeCalledWith(true);
      });
      describe('when a socket disconnect event is fired', () => {
        it('should remove the town listener for that socket, and stop sending events to it', async () => {
          TestUtils.setSessionTokenAndTownID(
            testingTown.coveyTownID,
            session.sessionToken,
            mockSocket,
          );
          townSubscriptionHandler(mockSocket);

          // find the 'disconnect' event handler for the socket, which should have been registered after the socket was connected
          const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect');
          if (disconnectHandler && disconnectHandler[1]) {
            disconnectHandler[1]();
            const newPlayer = new Player('should not be notified');
            await testingTown.addPlayer(newPlayer);
            expect(mockSocket.emit).not.toHaveBeenCalledWith('newPlayer', newPlayer);
          } else {
            fail('No disconnect handler registered');
          }
        });
        it('should destroy the session corresponding to that socket', async () => {
          TestUtils.setSessionTokenAndTownID(
            testingTown.coveyTownID,
            session.sessionToken,
            mockSocket,
          );
          townSubscriptionHandler(mockSocket);

          // find the 'disconnect' event handler for the socket, which should have been registered after the socket was connected
          const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect');
          if (disconnectHandler && disconnectHandler[1]) {
            disconnectHandler[1]();
            mockReset(mockSocket);
            TestUtils.setSessionTokenAndTownID(
              testingTown.coveyTownID,
              session.sessionToken,
              mockSocket,
            );
            townSubscriptionHandler(mockSocket);
            expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
          } else {
            fail('No disconnect handler registered');
          }
        });
      });
      it('should forward playerMovement events from the socket to subscribed listeners', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        const mockListener = mock<CoveyTownListener>();
        testingTown.addTownListener(mockListener);
        // find the 'playerMovement' event handler for the socket, which should have been registered after the socket was connected
        const playerMovementHandler = mockSocket.on.mock.calls.find(
          call => call[0] === 'playerMovement',
        );
        if (playerMovementHandler && playerMovementHandler[1]) {
          const newLocation = generateTestLocation();
          player.location = newLocation;
          playerMovementHandler[1](newLocation);
          expect(mockListener.onPlayerMoved).toHaveBeenCalledWith([player]);
        } else {
          fail('No playerMovement handler registered');
        }
      });
    });
  });
  describe('addConversationArea', () => {
    let testingTown: CoveyTownController;
    beforeEach(() => {
      const townName = `addConversationArea test town ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
    });
    it('should add the conversation area to the list of conversation areas', () => {
      const newConversationArea = TestUtils.createConversationForTesting();
      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      const areas = testingTown.conversationAreas;
      expect(areas.length).toEqual(1);
      expect(areas[0].label).toEqual(newConversationArea.label);
      expect(areas[0].topic).toEqual(newConversationArea.topic);
      expect(areas[0].boundingBox).toEqual(newConversationArea.boundingBox);
    });
  });
  describe('updatePlayerLocation', () => {
    let testingTown: CoveyTownController;
    beforeEach(() => {
      const townName = `updatePlayerLocation test town ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
    });
    it("should respect the conversation area reported by the player userLocation.conversationLabel, and not override it based on the player's x,y location", async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 10, y: 10, height: 5, width: 5 },
      });
      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);
      const player = new Player(nanoid());
      await testingTown.addPlayer(player);

      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 25,
        y: 25,
        conversationLabel: newConversationArea.label,
      };
      testingTown.updatePlayerLocation(player, newLocation);
      expect(player.activeConversationArea?.label).toEqual(newConversationArea.label);
      expect(player.activeConversationArea?.topic).toEqual(newConversationArea.topic);
      expect(player.activeConversationArea?.boundingBox).toEqual(newConversationArea.boundingBox);

      const areas = testingTown.conversationAreas;
      expect(areas[0].occupantsByID.length).toBe(1);
      expect(areas[0].occupantsByID[0]).toBe(player.id);
    });
    it('should emit an onConversationUpdated event when a conversation area gets a new occupant', async () => {
      const newConversationArea = TestUtils.createConversationForTesting({
        boundingBox: { x: 10, y: 10, height: 5, width: 5 },
      });
      const result = testingTown.addConversationArea(newConversationArea);
      expect(result).toBe(true);

      const mockListener = mock<CoveyTownListener>();
      testingTown.addTownListener(mockListener);

      const player = new Player(nanoid());
      await testingTown.addPlayer(player);
      const newLocation: UserLocation = {
        moving: false,
        rotation: 'front',
        x: 25,
        y: 25,
        conversationLabel: newConversationArea.label,
      };
      testingTown.updatePlayerLocation(player, newLocation);
      expect(mockListener.onConversationAreaUpdated).toHaveBeenCalledTimes(1);
    });
    describe('Update Player Location for Followers', () => {
      it('Should correctly add a players previous locations to the stack of their locations if it is not undefined', async () => {
        const player = new Player(nanoid());
        testingTown.addPlayer(player);
        expect(player.location).toBeDefined();
        const previousLocations = [player.location, generateTestLocation()];
        testingTown.updatePlayerLocation(player, previousLocations[1]);
        expect(player.location).toEqual(previousLocations[1]);
        expect(player.previousSteps).toEqual([previousLocations[0]]);
      });
      it('Should only keep the most recent 10 locations from a players previous locations', () => {
        const player = new Player(nanoid());
        testingTown.addPlayer(player);

        let playerLocations = [player.location];

        for (let idx = 0; idx < 2 * Player.PREVIOUS_STEP_SIZE; idx += 1) {
          expect(player.location).toEqual(playerLocations[playerLocations.length - 1]);
          const nextLocation = generateTestLocation();
          testingTown.updatePlayerLocation(player, nextLocation);
          expect(player.location).toEqual(nextLocation);
          expect(player.previousSteps).toEqual(playerLocations);
          playerLocations.push(nextLocation);
          expect(player.previousSteps.length).toBeLessThanOrEqual(Player.PREVIOUS_STEP_SIZE);
          if (playerLocations.length > Player.PREVIOUS_STEP_SIZE) {
            playerLocations = playerLocations.splice(-Player.PREVIOUS_STEP_SIZE);
          }
        }
      });
      it('Will not update a followers location until the player its following has a queue size of at-least MAX_STEP_SIZE', () => {
        const player = new Player(nanoid());
        testingTown.addPlayer(player);

        testingTown.addFollower(player, 'sprite');

        if (player.follower) {
          const followerLocation = player.follower.location;
          for (let idx = 0; idx < Player.PREVIOUS_STEP_SIZE; idx += 1) {
            testingTown.updatePlayerLocation(player, generateTestLocation());
            expect(player.follower.location).toBe(followerLocation);
          }
          testingTown.updatePlayerLocation(player, generateTestLocation());
          expect(player.follower.location).not.toBe(followerLocation);
        } else {
          fail('Follower not added properly');
        }
      });
      it('If the player stops moving, the followers stop as well', () => {
        const player = new Player(nanoid());
        testingTown.addPlayer(player);

        // Adding max followers to a player
        for (let idx = 0; idx < Player.MAX_FOLLOWERS; idx += 1) {
          testingTown.addFollower(player, 'sprite');
        }
        // Queing up player and its followers previousSteps
        for (let idx = 0; idx < Player.PREVIOUS_STEP_SIZE * Player.PREVIOUS_STEP_SIZE; idx += 1) {
          const location = generateTestLocation();
          // Every location is moving to test this.
          location.moving = true;
          testingTown.updatePlayerLocation(player, location);
        }
        /**
         * Returns whether or not any of the players or its followers has the moving
         * field on its current location
         * @param currentPlayer The player we are checking for
         * Returns if any was moving, false otherwise
         */
        const checkMoving = (currentPlayer: Player | undefined) => {
          let playerDepth = 0;
          while (currentPlayer) {
            playerDepth += 1;
            if (currentPlayer.location.moving) {
              return true;
            }
            currentPlayer = currentPlayer.follower;
          }
          expect(playerDepth).toBe(Player.MAX_FOLLOWERS + 1);
          return false;
        };

        expect(checkMoving(player)).toBe(true);
        const newPlayerLocation = generateTestLocation();
        newPlayerLocation.moving = false;

        testingTown.updatePlayerLocation(player, newPlayerLocation);
        expect(checkMoving(player)).toBe(false);
      });
      it('Will correctly make the spawned followers location be the player it is following', () => {
        const player = new Player(nanoid());
        testingTown.addPlayer(player);

        testingTown.updatePlayerLocation(player, generateTestLocation());

        testingTown.addFollower(player, 'test');
        if (player.follower) {
          expect(player.follower.location).toBe(player.location);
          // Moving the player around the map so its location is entirely different from its follower
          for (let idx = 0; idx < 2 * Player.PREVIOUS_STEP_SIZE; idx += 1) {
            testingTown.updatePlayerLocation(player, generateTestLocation());
          }
          expect(player.follower.location).not.toEqual(player.location);
          testingTown.addFollower(player, 'test');
          if (player.follower.follower) {
            expect(player.follower.follower.location).toEqual(player.follower.location);
          } else {
            fail('Failed to add a follower to the follower');
          }
        } else {
          fail('Player follower not correctly added');
        }
      });
      it('Will update a followers location to the last provided player location it is following', () => {
        const player = new Player(nanoid());
        testingTown.addPlayer(player);

        testingTown.addFollower(player, 'type');

        // Queueing up the player queue to have a full previous steps stack
        for (let idx = 0; idx < 2 * Player.PREVIOUS_STEP_SIZE; idx += 1) {
          testingTown.updatePlayerLocation(player, generateTestLocation());
        }

        for (let idx = 0; idx < 10; idx += 1) {
          expect(player.previousSteps.length).toBeGreaterThan(0);
          const playerOldestLocation =
            player.previousSteps[
              Math.max(player.previousSteps.length - Player.PREVIOUS_STEP_SIZE, 0)
            ];

          testingTown.updatePlayerLocation(player, generateTestLocation());
          if (player.follower) {
            expect(player.follower.location).toEqual(playerOldestLocation);
          } else {
            fail('Follower is undefined');
          }
        }
      });
      it('Updates a chain of followers step queues for a provided player', () => {
        const player = new Player(nanoid());
        testingTown.addPlayer(player);
        // Adding the max followers for a player;
        for (let idx = 0; idx < Player.MAX_FOLLOWERS; idx += 1) {
          testingTown.addFollower(player, 'test');
        }

        // Moving to Step Size ^2 random locations to move up a players queue
        for (let idx = 0; idx < Player.PREVIOUS_STEP_SIZE * Player.PREVIOUS_STEP_SIZE; idx += 1) {
          testingTown.updatePlayerLocation(player, generateTestLocation());
        }

        // Making max queue moves making sure each time it updates a location
        for (let cIter = 0; cIter < Player.PREVIOUS_STEP_SIZE + 1; cIter += 1) {
          // Marking which locations the followers and players are currently at
          const previousLocations = [];
          let currentPlayer: Player | undefined = player;
          while (currentPlayer) {
            previousLocations.push(
              currentPlayer.previousSteps[
                Math.max(player.previousSteps.length - Player.PREVIOUS_STEP_SIZE, 0)
              ],
            );
            currentPlayer = currentPlayer.follower;
          }

          testingTown.updatePlayerLocation(player, generateTestLocation());
          currentPlayer = player.follower;

          for (let idx = 1; idx < previousLocations.length; idx += 1) {
            if (currentPlayer) {
              expect(currentPlayer.location).toEqual(previousLocations[idx - 1]);
              currentPlayer = currentPlayer.follower;
            } else {
              fail('Current Player is undefined when it should not be');
            }
          }
        }
      });
      it('Correctly notifies any listener of all followers that need updates with a player update', () => {
        const player = new Player(nanoid());
        testingTown.addPlayer(player);
        // Adding the max followers for a player;
        for (let idx = 0; idx < Player.MAX_FOLLOWERS; idx += 1) {
          testingTown.addFollower(player, 'test');
        }

        // Moving to STEPSIZE^2 random locations to move up a players queue and its followers
        for (let idx = 0; idx < Player.PREVIOUS_STEP_SIZE * Player.PREVIOUS_STEP_SIZE; idx += 1) {
          testingTown.updatePlayerLocation(player, generateTestLocation());
        }

        const mockListener = mock<CoveyTownListener>();
        testingTown.addTownListener(mockListener);

        for (let idx = 0; idx < Player.PREVIOUS_STEP_SIZE; idx += 1) {
          testingTown.updatePlayerLocation(player, generateTestLocation());
        }
        expect(mockListener.onPlayerMoved).toHaveBeenCalledTimes(Player.PREVIOUS_STEP_SIZE);

        const playerFollowerList = [player];
        let currentFollower: Player | undefined = player.follower;
        while (currentFollower) {
          playerFollowerList.push(currentFollower);
          currentFollower = currentFollower.follower;
        }
        expect(playerFollowerList.length).toBe(Player.PREVIOUS_STEP_SIZE);
        expect(mockListener.onPlayerMoved).toHaveBeenLastCalledWith(playerFollowerList);
        // expect(mockListener.onPlayerMoved).toHaveBeenLastCalledWith(playerFollowerList);
      });
    });
    describe('Removing followers from the map', () => {
      it('Correctly removes followers as well when a player is deleted', async () => {
        const player = new Player(nanoid());
        const player2 = new Player(nanoid());
        const player3 = new Player(nanoid());

        const p1SessionId = await testingTown.addPlayer(player);
        const p2SessionId = await testingTown.addPlayer(player2);
        const p3SessionId = await testingTown.addPlayer(player3);

        for (let idx = 0; idx < Player.PREVIOUS_STEP_SIZE; idx += 1) {
          testingTown.addFollower(player, 'sprite_type');
          testingTown.addFollower(player2, 'sprite');
          testingTown.addFollower(player3, 'sprite3');
        }

        expect(testingTown.players.length).toBe(3 * Player.PREVIOUS_STEP_SIZE);

        testingTown.destroySession(p1SessionId);
        expect(testingTown.players.length).toBe(2 * Player.PREVIOUS_STEP_SIZE);

        testingTown.destroySession(p2SessionId);
        expect(testingTown.players.length).toBe(Player.PREVIOUS_STEP_SIZE);

        testingTown.destroySession(p3SessionId);
        expect(testingTown.players.length).toBe(0);
      });
      it('Sends out delete notifications for all followers tied to a player when a player disconnects', async () => {
        const mockListener = mock<CoveyTownListener>();
        const player = new Player(nanoid());

        const playerSessionID = await testingTown.addPlayer(player);
        testingTown.addTownListener(mockListener);

        for (let idx = 0; idx < Player.PREVIOUS_STEP_SIZE; idx += 1) {
          testingTown.addFollower(player, 'sprite');
        }
        expect(testingTown.players.length).toBe(Player.MAX_FOLLOWERS + 1);

        expect(mockListener.onPlayerDisconnected).toHaveBeenCalledTimes(0);
        testingTown.destroySession(playerSessionID);
        expect(mockListener.onPlayerDisconnected).toHaveBeenCalledTimes(Player.MAX_FOLLOWERS + 1);
        expect(testingTown.players.length).toBe(0);
      });
      it('Sends out the correct followers to destroy when a player leaves a session', async () => {
        const mockListener = mock<CoveyTownListener>();
        const player = new Player(nanoid());
        const player2 = new Player(nanoid());
        const player3 = new Player(nanoid());

        const playerSessionID = await testingTown.addPlayer(player);
        const player2SessionID = await testingTown.addPlayer(player2);
        const player3SessionID = await testingTown.addPlayer(player3);

        testingTown.addTownListener(mockListener);

        for (let idx = 0; idx < Player.MAX_FOLLOWERS; idx += 1) {
          testingTown.addFollower(player, 'sprite');
          testingTown.addFollower(player2, 'sprite');
          testingTown.addFollower(player3, 'sprite');
        }

        let removedPlayers: Player[] = [];

        mockListener.onPlayerDisconnected.mockImplementation(removedPlayer => {
          removedPlayers.push(removedPlayer);
        });
        const player1PlayerAndFollowers: Player[] = [player];
        const player2PlayerAndFollowers: Player[] = [player2];
        const player3PlayerAndFollowers: Player[] = [player3];

        expect(followerCount(player)).toBe(Player.MAX_FOLLOWERS);
        expect(followerCount(player2)).toBe(Player.MAX_FOLLOWERS);
        expect(followerCount(player3)).toBe(Player.MAX_FOLLOWERS);

        const playersLists = [
          player1PlayerAndFollowers,
          player2PlayerAndFollowers,
          player3PlayerAndFollowers,
        ];
        for (let idx = 0; idx < Player.MAX_FOLLOWERS; idx += 1) {
          for (let cList = 0; cList < playersLists.length; cList += 1) {
            const selectedList = playersLists[cList];
            const previousPlayer = selectedList[selectedList.length - 1];
            if (previousPlayer.follower) {
              selectedList.push(previousPlayer.follower);
            } else {
              fail('A provided list is missing a follower');
            }
          }
        }

        expect(mockListener.onPlayerDisconnected).toHaveBeenCalledTimes(0);
        testingTown.destroySession(playerSessionID);
        // Making sure that the removed players is player 1 and its followers
        expect(removedPlayers.length).toBe(Player.MAX_FOLLOWERS + 1);
        expect(removedPlayers).toEqual(player1PlayerAndFollowers);

        removedPlayers = [];
        testingTown.destroySession(player2SessionID);
        expect(removedPlayers.length).toBe(Player.MAX_FOLLOWERS + 1);
        expect(removedPlayers).toEqual(player2PlayerAndFollowers);

        removedPlayers = [];
        testingTown.destroySession(player3SessionID);
        expect(removedPlayers.length).toBe(Player.MAX_FOLLOWERS + 1);
        expect(removedPlayers).toEqual(player3PlayerAndFollowers);
      });
    });
    describe('Conversation Areas for Adding Followers', () => {
      it('If a player is inside a Conversation area when a follower is spawned this follower should also be inside it', () => {
        const player = new Player(nanoid());
        testingTown.addPlayer(player);
        const newConversationArea = TestUtils.createConversationForTesting({
          boundingBox: { x: 10, y: 10, height: 5, width: 5 },
        });
        testingTown.addConversationArea(newConversationArea);
        const newLocation: UserLocation = {
          moving: false,
          rotation: 'front',
          x: 25,
          y: 25,
          conversationLabel: newConversationArea.label,
        };
        testingTown.updatePlayerLocation(player, newLocation);
        expect(player.activeConversationArea?.label).toEqual(newConversationArea.label);
        expect(player.activeConversationArea?.topic).toEqual(newConversationArea.topic);

        testingTown.addFollower(player, 'test');
        if (player.follower) {
          expect(player.follower.activeConversationArea).toBeDefined();
          expect(player.follower.activeConversationArea).toBe(player.activeConversationArea);
        } else {
          fail('The provided follower failed to be added');
        }
      });
      it('If a player is not inside a Area when a follower is spawned this follower also isnt in one', () => {
        const player = new Player(nanoid());
        testingTown.addPlayer(player);

        expect(player.activeConversationArea).not.toBeDefined();

        testingTown.addFollower(player, 'test');
        if (player.follower) {
          expect(player.follower.activeConversationArea).not.toBeDefined();
        } else {
          fail('The provided follower failed to be added');
        }
      });
      it('If followers join a conversation area, the listeners are notified', () => {
        const mockListeners = [
          mock<CoveyTownListener>(),
          mock<CoveyTownListener>(),
          mock<CoveyTownListener>(),
        ];
        const player = new Player(nanoid());
        testingTown.addPlayer(player);
        mockListeners.forEach(listener => testingTown.addTownListener(listener));

        const newConversationArea = TestUtils.createConversationForTesting({
          boundingBox: { x: 10, y: 10, height: 5, width: 5 },
        });
        testingTown.addConversationArea(newConversationArea);
        mockListeners.forEach(listener =>
          expect(listener.onConversationAreaUpdated).toHaveBeenCalledTimes(1),
        );
        const newLocation: UserLocation = {
          moving: false,
          rotation: 'front',
          x: 25,
          y: 25,
          conversationLabel: newConversationArea.label,
        };
        testingTown.updatePlayerLocation(player, newLocation);
        mockListeners.forEach(listener =>
          expect(listener.onConversationAreaUpdated).toHaveBeenCalledTimes(2),
        );
        testingTown.addFollower(player, 'test');
        mockListeners.forEach(listener =>
          expect(listener.onConversationAreaUpdated).toHaveBeenCalledTimes(3),
        );
        testingTown.addFollower(player, 'test');
        mockListeners.forEach(listener =>
          expect(listener.onConversationAreaUpdated).toHaveBeenCalledTimes(4),
        );
      });
      it('If a follower joins the conversation area, they are actually added to the areas occupants', () => {
        const player = new Player(nanoid());
        testingTown.addPlayer(player);

        const newConversationArea = TestUtils.createConversationForTesting({
          boundingBox: { x: 10, y: 10, height: 5, width: 5 },
        });
        testingTown.addConversationArea(newConversationArea);
        const newLocation: UserLocation = {
          moving: false,
          rotation: 'front',
          x: 25,
          y: 25,
          conversationLabel: newConversationArea.label,
        };
        testingTown.updatePlayerLocation(player, newLocation);
        if (player.activeConversationArea) {
          expect(player.activeConversationArea.occupantsByID).toEqual([player.id]);

          for (let idx = 0; idx < Player.MAX_FOLLOWERS; idx += 1) {
            testingTown.addFollower(player, 'test');
          }
          expect(player.activeConversationArea.occupantsByID.length).toBe(Player.MAX_FOLLOWERS + 1);
          const playerAndFollowerIds = [player.id];
          let currentFollower = player.follower;
          while (currentFollower) {
            playerAndFollowerIds.push(currentFollower.id);
            currentFollower = currentFollower.follower;
          }
          expect(player.activeConversationArea.occupantsByID).toEqual(playerAndFollowerIds);
        } else {
          fail('Player should be in a conversation area that is defined');
        }
      });
    });
  });
});
