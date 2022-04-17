import { mockDeep } from 'jest-mock-extended';
import CoveyTownController from '../lib/CoveyTownController';
import TwilioVideo from '../lib/TwilioVideo';
import Player from './Player';
import * as TestUtils from '../client/TestUtils';
import { UserLocation } from '../CoveyTypes';

const mockTwilioVideo = mockDeep<TwilioVideo>();
jest.spyOn(TwilioVideo, 'getInstance').mockReturnValue(mockTwilioVideo);

describe('Follower', () => {
  mockTwilioVideo.getTokenForTown.mockClear();
  let testingTown: CoveyTownController;
  beforeEach(() => {
    const townName = 'testing town for follower functionality';
    testingTown = new CoveyTownController(townName, false);
  });
  it('new players should have an undefined follower', () => {
    const player = new Player('test player');
    expect(player.follower).toBe(undefined);
  });

  describe('adding a follower', () => {
    it('players follower field should reflect its follower', () => {
      const player = new Player('test player');
      const pet = new Player('test pet');
      player.follower = pet;
      expect(player.follower?.userName).toEqual(pet.userName);
    });
    it('addFollower should properly add the first follower to a player', () => {
      const player = new Player('test player');
      testingTown.addPlayer(player);
      expect(player.follower).toBe(undefined);
      const petArea = TestUtils.createPetAreaForTesting();
      testingTown.addPetArea(petArea);
      const location:UserLocation = { moving: false, rotation: 'front', x: 400, y: 400 };
      testingTown.updatePlayerLocation(player, location);
      testingTown.addFollower(player, player.id);
      expect(player.follower?.userName).toBe('Pet');
      expect(testingTown.players.length).toBe(2);
    });
    it('addFollower should properly add followers to the player after the first one', () => {
      const player = new Player('test player');
      testingTown.addPlayer(player);
      expect(player.follower).toBe(undefined);
      testingTown.addFollower(player, player.id);
      expect(player.follower?.userName).toBe('Pet');
      expect(testingTown.players.length).toBe(2);

      testingTown.addFollower(player, player.id);
      expect(player.follower?.userName).toBe('Pet');
      const firstPet = player.follower;
      expect(firstPet?.follower?.userName).toBe('Pet');
      expect(testingTown.players.length).toBe(3);

      testingTown.addFollower(player, player.id);
      const secondPet = firstPet?.follower;
      expect(secondPet?.follower?.userName).toBe('Pet');
      expect(testingTown.players.length).toBe(4);
    });
    it('addFollower should add the follower to the correct player', () => {
      const player1 = new Player('first test player');
      const player2 = new Player('second test player');
      testingTown.addPlayer(player1);
      testingTown.addPlayer(player2);
      testingTown.addFollower(player1, player1.id);
      expect(player1.follower?.userName).toBe('Pet');
      expect(player2.follower).toBe(undefined);

      testingTown.addFollower(player2, player2.id);
      expect(player2.follower?.userName).toBe('Pet');
    });
    it('addFollower should not add more than seven followers to a player', () => {
      let player1 = new Player('first test player');
      testingTown.addPlayer(player1);

      testingTown.addFollower(player1, player1.id);
      testingTown.addFollower(player1, player1.id);
      testingTown.addFollower(player1, player1.id);
      testingTown.addFollower(player1, player1.id);
      testingTown.addFollower(player1, player1.id);
      testingTown.addFollower(player1, player1.id);
      testingTown.addFollower(player1, player1.id);
      testingTown.addFollower(player1, player1.id);

      let currentDepth = 0;
      while (player1.follower !== undefined) {
        player1 = player1.follower;
        currentDepth += 1;
      }

      expect(currentDepth).toEqual(7);
    });
  });
  
  describe('follower location', () => {
    it('player follower field should have a correctly positioned follower', () => {
      const player = new Player('test player');
      const pet = new Player('test pet');
      player.follower = pet;
      expect(player.follower?.userName).toEqual(pet.userName)
      expect(player.follower.location).toEqual(player.location);
    });
    it('multiple player followers should have correct positions', () => {
      const player = new Player('test player');
      const pet = new Player('test pet');
      const pet2 = new Player('test pet2');
      testingTown.addPlayer(player1);
      testingTown.addFollower(player1);
      testingTown.addFollower(player1);
      expect(player.follower?.userName).toEqual(pet.userName)
      expect(player.follower?.location).toEqual(player.location);
      expect(player.follower?.?followers.location).toEqual(player.location);
    });
    
    describe('follower conversation area', () => {
    it('player follower without conversation area is same as plater', () => {
      const player1 = new Player('test player');
      testingTown.addPlayer(player1);
      testingTown.addFollower(player1);
      expect(player.follower?.conversationArea).toEqual(player.conversationArea);
      expect(player.follower.conversationArea).not.toBeDefined();
    });
    it('multiple player followers should have correct conversationarea', () => {
      const player = new Player('test player');
      const pet = new Player('test pet');
      const pet2 = new Player('test pet2');
      testingTown.addPlayer(player1);
      testingTown.addFollower(player1);
      testingTown.addFollower(player1);
      expect(player.follower?.conversationArea).toEqual(player.conversationArea);
      expect(player.follower?.follower?.conversationArea).toEqual(player.conversationArea);
    });
  }

      testingTown.updatePlayerLocation(player1, location1);
      testingTown.updatePlayerLocation(player2, location2);

      const player1Follower = testingTown.addFollower(player1, player1.id);
      const player2Follower = testingTown.addFollower(player2, player2.id);
      expect(player1Follower).toBe(true);
      expect(player2Follower).toBe(false);
    });
    it('should allow multiple players on the map to have pets', () => {
      let player1 = new Player('first test player');
      let player2 = new Player('second test player');
      testingTown.addPlayer(player1);
      testingTown.addPlayer(player2);
      testingTown.addFollower(player1, player1.id);
      testingTown.addFollower(player1, player1.id);
      testingTown.addFollower(player2, player2.id);
      expect(player1.follower?.userName).toBe('Pet');
      expect(player2.follower?.userName).toBe('Pet');
    });
  });
});
