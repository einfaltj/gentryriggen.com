const R = require('ramda');
const Q = require('q');
const slackUtils = require('../../slackUtils');
const slack = require('slack');
const userRepo = require('../../repos/user.repo');
const matchRepo = require('../../repos/match.repo');
const rankingsRepo = require('../../repos/ranking.repo');
const seasonRepo = require('../../repos/season.repo');

const getRatingDelta = (myRating, opponentRating, myGameResult) => {
  if ([0, 0.5, 1].indexOf(myGameResult) === -1) {
    return null;
  }

  const myChanceToWin = 1 / ( 1 + Math.pow(10, (opponentRating - myRating) / 400));

  return Math.round(32 * (myGameResult - myChanceToWin));
};

const getNewRating = (myRating, opponentRating, myGameResult) => {
  return myRating + getRatingDelta(myRating, opponentRating, myGameResult);
};

module.exports = function (param, loser) {
  const channel = R.propOr('', 'channel', param);
  const args = R.propOr([], 'args', param);

  const skunk = args[0] === 'skunk' || args[0] === 'skunked';

  if (!skunk && args.length < 4) {
    invalidMessage(channel);
    return;
  }

  const specifiedWinner = args[1];
  const winnerId = slackUtils.getMentionId(specifiedWinner);
  if (loser.userId == winnerId) {
    slackUtils.postMessage(channel, `You would find a way to lose to yourself, ${loser.username}...`);
    return;
  }

  userRepo.getAllById(winnerId)
    .then((winner) => {
      if (!winner) {
        slackUtils.postMessage(channel, 'I couldn\'t find the users... You should probably be working anyway.');
        return;
      }

      const loserNewELO = getNewRating(loser.elo, winner.elo, 0);
      const winnerNewELO = getNewRating(winner.elo, loser.elo, 1);

      let loserPoints;
      if (skunk) {
        loserPoints = 0;
      } else {
        const lostBy = parseInt(args[3]);
        if (lostBy < 2) {
          slackUtils.postMessage(channel, 'Lose by 2 or I will make you lose by 21!');
          return;
        } else if (lostBy > 19) {
          slackUtils.postMessage(channel, 'You either got skunked or don\'t know how to play this game...');
          return;
        }
        loserPoints = 21 - lostBy;
      }

      const match = {
        seasonId: loser.seasonId,
        loserId: loser.userId,
        loserOldELO: loser.elo,
        loserNewELO,
        winnerId: winner.userId,
        winnerOldELO: winner.elo,
        winnerNewELO,
        winnerPoints: 21,
        loserPoints,
        skunk: skunk ? 1 : 0,
        dateCreated: (new Date()).toMysqlFormat(),
      };

      matchRepo.createOrUpdate(match)
        .then(() => {
          let rankings = [];
          rankings.push(rankingsRepo.updateUserRanking(loser.seasonId, loser.userId));
          rankings.push(rankingsRepo.updateUserRanking(loser.seasonId, winner.userId));
          Q.all(rankings)
            .then(() => {
              seasonRepo.getLeaderboard(loser.seasonId)
                .then((leaderboard) => {
                  if (skunk) {
                    slackUtils.postMessage(channel, 'SKUNKED!!! This match has been recorded as 0-21. Ouch...');
                  }
                  slackUtils.postLeaderboard(channel, leaderboard);
                });
            });
        });
    })
    .catch(() => {
      slackUtils.postMessage(channel, `I have never heard of *${specifiedWinner}*. Ask them to register?`);
    });
};

const invalidMessage = (channel) => {
  const response = [
    'Invalid command bruh!',
    'pong lost to @yourmom by 19',
    'Yeah you lost 2-21 because you suck...',
  ];
  slackUtils.postMessage(channel, response.join('\n'));
};
