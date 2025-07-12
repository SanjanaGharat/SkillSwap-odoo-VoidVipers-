/**
 * Aggregation Pipelines for SkillSwap
 * Provides reusable MongoDB aggregation pipelines for complex queries
 */

class AggregationPipelines {
  /**
   * Get user recommendations based on skill compatibility
   */
  static getUserRecommendations(userId, limit = 10) {
    return [
      // Stage 1: Get the current user's skills
      {
        $match: { _id: userId }
      },
      // Stage 2: Lookup users who have skills the current user wants
      {
        $lookup: {
          from: 'users',
          let: { 
            wantedSkills: '$skillsWanted.skillId',
            offeredSkills: '$skillsOffered.skillId'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ['$_id', '$$userId'] },
                    { $eq: ['$profileVisibility', 'public'] },
                    { $eq: ['$isActive', true] },
                    {
                      $anyElementTrue: {
                        $map: {
                          input: '$skillsOffered',
                          as: 'offered',
                          in: {
                            $in: ['$$offered.skillId', '$$wantedSkills']
                          }
                        }
                      }
                    }
                  ]
                }
              }
            },
            {
              $addFields: {
                matchScore: {
                  $add: [
                    {
                      $size: {
                        $setIntersection: [
                          '$skillsOffered.skillId',
                          '$$wantedSkills'
                        ]
                      }
                    },
                    {
                      $size: {
                        $setIntersection: [
                          '$skillsWanted.skillId',
                          '$$offeredSkills'
                        ]
                      }
                    }
                  ]
                }
              }
            },
            {
              $sort: { matchScore: -1, 'rating.average': -1 }
            },
            {
              $limit: limit
            }
          ],
          as: 'recommendations'
        }
      },
      // Stage 3: Project the results
      {
        $project: {
          recommendations: 1
        }
      }
    ];
  }

  /**
   * Get skill popularity statistics
   */
  static getSkillPopularityStats() {
    return [
      {
        $unwind: '$skillsOffered'
      },
      {
        $group: {
          _id: '$skillsOffered.skillId',
          skillName: { $first: '$skillsOffered.name' },
          userCount: { $sum: 1 },
          avgRating: { $avg: '$rating.average' }
        }
      },
      {
        $sort: { userCount: -1 }
      },
      {
        $limit: 20
      }
    ];
  }

  /**
   * Get user activity statistics
   */
  static getUserActivityStats(days = 30) {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    return [
      {
        $match: {
          lastActive: { $gte: dateThreshold }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$lastActive'
            }
          },
          activeUsers: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ];
  }

  /**
   * Get swap success statistics
   */
  static getSwapSuccessStats() {
    return [
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgDuration: {
            $avg: {
              $subtract: ['$updatedAt', '$createdAt']
            }
          }
        }
      },
      {
        $sort: { count: -1 }
      }
    ];
  }

  /**
   * Get skill category distribution
   */
  static getSkillCategoryDistribution() {
    return [
      {
        $unwind: '$skillsOffered'
      },
      {
        $group: {
          _id: '$skillsOffered.category',
          skillCount: { $sum: 1 },
          uniqueUsers: { $addToSet: '$_id' }
        }
      },
      {
        $addFields: {
          userCount: { $size: '$uniqueUsers' }
        }
      },
      {
        $project: {
          uniqueUsers: 0
        }
      },
      {
        $sort: { skillCount: -1 }
      }
    ];
  }

  /**
   * Get location-based user distribution
   */
  static getLocationDistribution() {
    return [
      {
        $match: {
          location: { $exists: true, $ne: null },
          profileVisibility: 'public',
          isActive: true
        }
      },
      {
        $group: {
          _id: '$location',
          userCount: { $sum: 1 },
          avgRating: { $avg: '$rating.average' }
        }
      },
      {
        $sort: { userCount: -1 }
      },
      {
        $limit: 20
      }
    ];
  }

  /**
   * Get user growth over time
   */
  static getUserGrowthStats() {
    return [
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m',
              date: '$createdAt'
            }
          },
          newUsers: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ];
  }

  /**
   * Get skill matching statistics
   */
  static getSkillMatchingStats() {
    return [
      {
        $addFields: {
          offeredSkillCount: { $size: '$skillsOffered' },
          wantedSkillCount: { $size: '$skillsWanted' }
        }
      },
      {
        $group: {
          _id: null,
          avgOfferedSkills: { $avg: '$offeredSkillCount' },
          avgWantedSkills: { $avg: '$wantedSkillCount' },
          totalUsers: { $sum: 1 }
        }
      }
    ];
  }

  /**
   * Get top performing users
   */
  static getTopPerformingUsers(limit = 10) {
    return [
      {
        $match: {
          profileVisibility: 'public',
          isActive: true,
          'rating.count': { $gte: 1 }
        }
      },
      {
        $sort: {
          'rating.average': -1,
          'rating.count': -1
        }
      },
      {
        $limit: limit
      },
      {
        $project: {
          name: 1,
          location: 1,
          rating: 1,
          skillsOffered: { $slice: ['$skillsOffered', 3] },
          lastActive: 1
        }
      }
    ];
  }

  /**
   * Get recent activity feed
   */
  static getRecentActivityFeed(limit = 20) {
    return [
      {
        $match: {
          profileVisibility: 'public',
          isActive: true
        }
      },
      {
        $sort: { lastActive: -1 }
      },
      {
        $limit: limit
      },
      {
        $project: {
          name: 1,
          location: 1,
          lastActive: 1,
          skillsOffered: { $slice: ['$skillsOffered', 2] },
          rating: 1
        }
      }
    ];
  }
}

module.exports = AggregationPipelines; 