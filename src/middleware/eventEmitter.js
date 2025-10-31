const EventEmitter = require('events');

class MdSCEventEmitter extends EventEmitter {}

const eventEmitter = new MdSCEventEmitter();

const EVENTS = {
  LESSON_COMPLETED: 'lesson:completed',
  QUIZ_STARTED: 'quiz:started',
  QUIZ_PASSED: 'quiz:passed',
  QUIZ_FAILED: 'quiz:failed',
  QUIZ_PERFECT_SCORE: 'quiz:perfect_score',
  COURSE_COMPLETED: 'course:completed',
  BADGE_EARNED: 'badge:earned',
  CERTIFICATE_GENERATED: 'certificate:generated',
  XP_GAINED: 'xp:gained',
  LEVEL_UP: 'level:up',
  STREAK_UPDATED: 'streak:updated',
};

module.exports = { eventEmitter, EVENTS };


