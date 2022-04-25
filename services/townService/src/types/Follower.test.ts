import { mockDeep } from 'jest-mock-extended';
import { UserLocation } from '../CoveyTypes';
import CoveyTownController from '../lib/CoveyTownController';
import TwilioVideo from '../lib/TwilioVideo';
import Player from './Player';

const mockTwilioVideo = mockDeep<TwilioVideo>();
jest.spyOn(TwilioVideo, 'getInstance').mockReturnValue(mockTwilioVideo);

/**
 * Calculates how many followers exist in a provived player.
 * @param player The Player we aare calculating the number of followers for
 * Returns the number of followers following a player
 */
function followerCount(player: Player) {
  let output = 0;

  let currentPlayer: Player | undefined = player.follower;
  while (currentPlayer) {
    output += 1;
    currentPlayer = currentPlayer.follower;
  }

  return output;
}

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
      const location: UserLocation = { moving: false, rotation: 'front', x: 400, y: 400 };
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
      const player1 = new Player('first test player');
      testingTown.addPlayer(player1);

      testingTown.addFollower(player1, player1.id);
      testingTown.addFollower(player1, player1.id);
      testingTown.addFollower(player1, player1.id);
      testingTown.addFollower(player1, player1.id);
      testingTown.addFollower(player1, player1.id);
      testingTown.addFollower(player1, player1.id);
      testingTown.addFollower(player1, player1.id);
      testingTown.addFollower(player1, player1.id);

      expect(followerCount(player1)).toEqual(7);
    });

    it('should allow multiple players on the map to have pets', () => {
      const player1 = new Player('first test player');
      const player2 = new Player('second test player');
      testingTown.addPlayer(player1);
      testingTown.addPlayer(player2);
      testingTown.addFollower(player1, player1.id);
      testingTown.addFollower(player1, player1.id);
      testingTown.addFollower(player2, player2.id);
      expect(player1.follower?.userName).toBe('Pet');
      expect(player2.follower?.userName).toBe('Pet');
    });
    it('Should add the correct Sprite Type for each follower added', () => {
      const player1 = new Player('first test player');
      testingTown.addPlayer(player1);
      expect(player1.follower).toBeUndefined();
      const followerSpriteTypes = ['sp1', 'sp2', 'sp3', 'sp4', 'sp5', 'sp6', 'sp7', 'sp8'];
      for (let idx = 0; idx < followerSpriteTypes.length; idx += 1) {
        testingTown.addFollower(player1, followerSpriteTypes[idx]);
      }
      expect(followerCount(player1)).toBe(7);
      let currentPlayer = player1.follower;
      for (let idx = 0; idx < 7; idx += 1) {
        if (currentPlayer !== undefined) {
          expect(currentPlayer.spriteType).toEqual(followerSpriteTypes[idx]);
        } else {
          fail('Undefined follower when the current follower should be defined');
        }
        currentPlayer = currentPlayer.follower;
      }
    });
  });
});
