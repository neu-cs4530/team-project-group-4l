import Player from './Player';

describe('Follower', () => {
  beforeEach(() => {

  });
  it('new players should have an undefined follower', () => {
    const player = new Player('test player');
    expect(player.follower).toBe(undefined);
  });
  describe('adding a follower', () => {
    it('should set the player\'s follower field ', () => {
      const player = new Player('test player');
      const pet = new Player('test pet');
      player.follower = pet;
      expect(player.follower?.userName).toEqual(pet.userName);
    });
  });
});
