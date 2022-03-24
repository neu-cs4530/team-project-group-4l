import APlayer from './APlayer';
import Follower from './Follower';
/**
 * Each user who is connected to a town is represented by a Player object
 */
export default class Player extends APlayer {
  private follower: Follower = new Follower('removeLater');
}
