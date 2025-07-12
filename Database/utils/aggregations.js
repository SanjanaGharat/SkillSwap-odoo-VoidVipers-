// utils/aggregations.js
const mongoose = require('mongoose');

class AggregationPipelines {
  
  /**
   * Find users who can fulfill a skill exchange
   * @param {Object} params - Search parameters
   * @param {string} params.skillOffered - Skill the current user offers
   * @param {string} params.skillWanted - Skill the current user wants
   * @param {string} params.currentUserId - Current user's ID
   * @param {string} params.location - Optional location filter
   * @param {string} params.availability - Optional availability filter
   * @param {number} params.limit - Results limit
   */
  static findMatchingUsers(params) {
    const {
      skillOffered,
      skillWanted,
      currentUserId,
      location,
      availability,
      limit = 20
    } = params;

    const pipeline = [
      // Match users with compatible skills
      {
        $match: {
          _id: { $ne: mongoose.Types.ObjectId(currentUserId) },
          profileVisibility: 'public',
          isActive: true,
          $and: [
            { 'skillsOffered.name': { $regex: skillWanted, $options: 'i' } },
            { 'skillsWanted.name': { $regex: skillOffered, $options: 'i' } }
          ]
        }
      },
      
      // Add location and availability filters if provided
      ...(location ? [{ $match: { location: { $regex: location, $options: 'i' } } }] : []),
      ...(availability ? [{ $match: { availability: availability } }] : []),
      
      // Calculate match score
      {
        $addFields: {
          matchScore: {
            $add: [
              // Score for offering what user wants
              {
                $size: {
                  $filter: {
                    input: '$skillsOffered',
                    cond: {
                      $regexMatch: {
                        input: '$$this.name',
                        regex: skillWanted,
                        options: 'i'
                      }
                    }
                  }
                }
              },
              // Score for wanting what user offers
              {
                $size: {
                  $filter: {
                    input: '$skillsWanted',
                    cond: {
                      $regexMatch: {
                        input: '$$this.name',
                        regex: skillOffered,
                        options: 'i'
                      }
                    }
                  }
                }
              },
              // Bonus for higher rating
              { $multiply: ['$rating.average', 0.2] },
              // Bonus for recent activity
              {
                $cond: {
                  if: {
                    $gte: [
                      '$lastActive',
                      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last week
                    ]
                  },
                  then: 1,
                  else: 0
                }
              }
            ]
          }
        }
      },
      
      // Sort by match score and rating
      {
        $sort: {
          matchScore: -1,
          'rating.average': -1,
          lastActive: -1
        }
      },
      
      // Project only needed fields
      {
        $project: {
          name: 1,
          profilePhotoUrl: 1,
          location: 1,
          availability: 1,
          rating: 1,
          lastActive: 1,
          isOnline: 1,
          matchScore: 1,
          skillsOffered: {
            $filter: {
              input: '$skillsOffered',
              cond: {
                $regexMatch: {
                  input: '$$this.name',
                  regex: skillWanted,
                  options: 'i'
                }
              }
            }
          },
          skillsWanted: {
            $filter: {
              input: '$skillsWanted',
              cond: {
                $regexMatch: {
                  input: '$$this.name',
                  regex: skillOffered,
                  options: 'i'
                }
              }
            }
          }
        }
      },
      
      { $limit: limit }
    ];

    return pipeline;
  }

  /**
   * Get user dashboard statistics
   * @param {string} userId - User ID
   */
  static getUserDashboardStats(userId) {
    return [
      {
        $match: { _id: mongoose.Types.ObjectId(userId) }
      },
      {
        $lookup: {
          from: 'swaprequests',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ['$requester.userId', '$$userId'] },
                    { $eq: ['$receiver.userId', '$$userId'] }
                  ]
                }
              }
            },
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                requests: { $push: '$$ROOT' }
              }
            }
          ],
          as: 'requestStats'
        }
      },
      {
        $lookup: {
          from: 'messages',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$receiver.userId', '$$userId'] },
                    { $eq: ['$isRead', false] }
                  ]
                }
              }
            },
            { $count: 'unreadCount' }
          ],
          as: 'unreadMessages'
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          rating: 1,
          skillsOffered: 1,
          skillsWanted: 1,
          requestStats: 1,
          unreadMessageCount: {
            $ifNull: [{ $arrayElemAt: ['$unreadMessages.unreadCount', 0] }, 0]
          }
        }
      }
    ];
  }

  /**
   * Get popular skills with usage statistics
   * @param {number} limit - Number of skills to return
   */
  static getPopularSkills(limit = 50) {
    return [
      {
        $group: {
          _id: '$name',
          category: { $first: '$category' },
          totalUsers: { $sum: 1 },
          avgRating: { $avg: '$popularity' },
          skillData: { $first: '$$ROOT' }
        }
      },
      {
        $lookup: {
          from: 'users',
          let: { skillName: '$_id' },
          pipeline: [
            {
              $match: {
                $or: [
                  { 'skillsOffered.name': { $regex: '$$skillName', $options: 'i' } },
                  { 'skillsWanted.name': { $regex: '$$skillName', $options: 'i' } }
                ]
              }
            },
            {
              $project: {
                offersSkill: {
                  $size: {
                    $filter: {
                      input: '$skillsOffered',
                      cond: { $eq: ['$$this.name', '$$skillName'] }
                    }
                  }
                },
                wantsSkill: {
                  $size: {
                    $filter: {
                      input: '$skillsWanted',
                      cond: { $eq: ['$$this.name', '$$skillName'] }
                    }
                  }
                }
              }
            },
            {
              $group: {
                _id: null,
                offersCount: { $sum: '$offersSkill' },
                wantsCount: { $sum: '$wantsSkill' }
              }
            }
          ],
          as: 'usageStats'
        }
      },
      {
        $addFields: {
          usage: { $arrayElemAt: ['$usageStats', 0] },
          demandSupplyRatio: {
            $cond: {
              if: { $gt: [{ $arrayElemAt: ['$usageStats.offersCount', 0] }, 0] },
              then: {
                $divide: [
                  { $arrayElemAt: ['$usageStats.wantsCount', 0] },
                  { $arrayElemAt: ['$usageStats.offersCount', 0] }
                ]
              },
              else: 0
            }
          }
        }
      },
      {
        $sort: {
          totalUsers: -1,
          'usage.offersCount': -1
        }
      },
      {
        $limit: limit
      },
      {
        $project: {
          skillName: '$_id',
          category: 1,
          totalUsers: 1,
          offersCount: '$usage.offersCount',
          wantsCount: '$usage.wantsCount',
          demandSupplyRatio: 1
        }
      }
    ];
  }

  /**
   * Get skill exchange analytics
   * @param {Date} startDate - Start date for analysis
   * @param {Date} endDate - End date for analysis
   */
  static getSkillExchangeAnalytics(startDate, endDate) {
    return [
      {
        $match: {
          createdAt: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $group: {
          _id: {
            offeredSkill: '$skillExchange.offered.name',
            wantedSkill: '$skillExchange.wanted.name',
            status: '$status'
          },
          count: { $sum: 1 },
          avgRating: {
            $avg: {
              $add: [
                '$ratings.requesterRating.rating',
                '$ratings.receiverRating.rating'
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: {
            offeredSkill: '$_id.offeredSkill',
            wantedSkill: '$_id.wantedSkill'
          },
          totalRequests: { $sum: '$count' },
          statusBreakdown: {
            $push: {
              status: '$_id.status',
              count: '$count'
            }
          },
          avgRating: { $avg: '$avgRating' }
        }
      },
      {
        $sort: { totalRequests: -1 }
      }
    ];
  }

  /**
   * Get user activity timeline
   * @param {string} userId - User ID
   * @param {number} days - Number of days to look back
   */
  static getUserActivityTimeline(userId, days = 30) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return [
      {
        $match: {
          $or: [
            { 'requester.userId': mongoose.Types.ObjectId(userId) },
            { 'receiver.userId': mongoose.Types.ObjectId(userId) }
          ],
          createdAt: { $gte: startDate }
        }
      },
      {
        $lookup: {
          from: 'messages',
          localField: '_id',
          foreignField: 'swapRequestId',
          as: 'messages'
        }
      },
      {
        $addFields: {
          userRole: {
            $cond: {
              if: { $eq: ['$requester.userId', mongoose.Types.ObjectId(userId)] },
              then: 'requester',
              else: 'receiver'
            }
          },
          messageCount: { $size: '$messages' },
          lastMessageDate: { $max: '$messages.createdAt' }
        }
      },
      {
        $project: {
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt'
            }
          },
          userRole: 1,
          status: 1,
          skillExchange: 1,
          messageCount: 1,
          lastMessageDate: 1,
          completedAt: 1
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ];
  }

  /**
   * Find trending skills based on recent activity
   * @param {number} days - Number of days to analyze
   * @param {number} limit - Number of skills to return
   */
  static getTrendingSkills(days = 7, limit = 20) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return [
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          allSkills: {
            $push: {
              $concatArrays: [
                ['$skillExchange.offered.name'],
                ['$skillExchange.wanted.name']
              ]
            }
          }
        }
      },
      {
        $project: {
          skills: {
            $reduce: {
              input: '$allSkills',
              initialValue: [],
              in: { $concatArrays: ['$$value', '$$this'] }
            }
          }
        }
      },
      { $unwind: '$skills' },
      {
        $group: {
          _id: '$skills',
          requestCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'skills',
          localField: '_id',
          foreignField: 'name',
          as: 'skillInfo'
        }
      },
      {
        $addFields: {
          skillData: { $arrayElemAt: ['$skillInfo', 0] },
          trendScore: {
            $multiply: [
              '$requestCount',
              { $divide: [days, 7] } // Normalize for weekly trends
            ]
          }
        }
      },
      {
        $sort: { trendScore: -1 }
      },
      {
        $limit: limit
      },
      {
        $project: {
          skillName: '$_id',
          category: '$skillData.category',
          requestCount: 1,
          trendScore: 1,
          popularity: '$skillData.popularity'
        }
      }
    ];
  }

  /**
   * Get user recommendations based on their skills and activity
   * @param {string} userId - User ID
   * @param {number} limit - Number of recommendations
   */
  static getUserRecommendations(userId, limit = 10) {
    return [
      {
        $match: { _id: mongoose.Types.ObjectId(userId) }
      },
      {
        $lookup: {
          from: 'users',
          let: { 
            userSkillsOffered: '$skillsOffered.name',
            userSkillsWanted: '$skillsWanted.name',
            userLocation: '$location',
            userId: '$_id'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $ne: ['$_id', '$$userId'] },
                    { $eq: ['$profileVisibility', 'public'] },
                    { $eq: ['$isActive', true] }
                  ]
                }
              }
            },
            {
              $addFields: {
                compatibilityScore: {
                  $add: [
                    // Skills they offer that user wants
                    {
                      $size: {
                        $setIntersection: [
                          '$skillsOffered.name',
                          '$$userSkillsWanted'
                        ]
                      }
                    },
                    // Skills they want that user offers
                    {
                      $size: {
                        $setIntersection: [
                          '$skillsWanted.name',
                          '$$userSkillsOffered'
                        ]
                      }
                    },
                    // Location bonus
                    {
                      $cond: {
                        if: { $eq: ['$location', '$$userLocation'] },
                        then: 1,
                        else: 0
                      }
                    },
                    // Rating bonus
                    { $multiply: ['$rating.average', 0.2] }
                  ]
                }
              }
            },
            {
              $match: { compatibilityScore: { $gt: 0 } }
            },
            {
              $sort: { compatibilityScore: -1, 'rating.average': -1 }
            },
            { $limit: limit }
          ],
          as: 'recommendations'
        }
      },
      {
        $project: {
          recommendations: 1
        }
      }
    ];
  }
}

module.exports = AggregationPipelines;