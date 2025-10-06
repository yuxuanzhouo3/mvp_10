'use client'

import { useState, useEffect } from 'react'
import { 
  MapPin, 
  Building, 
  DollarSign, 
  Clock, 
  Star, 
  Filter,
  TrendingUp,
  Briefcase
} from 'lucide-react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'

interface Job {
  id: string
  title: string
  company: string
  location: string
  salary: string
  type: string
  matchScore: number
  matchReasons: string[]
  postedDate: string
  skills: string[]
  description: string
}

const mockJobs: Job[] = [
  {
    id: '1',
    title: 'Senior Machine Learning Engineer',
    company: 'Google',
    location: 'Mountain View, CA',
    salary: '$150,000 - $200,000',
    type: 'Full-time',
    matchScore: 95,
    matchReasons: ['NLP experience matches', 'Python expertise', 'ML project portfolio'],
    postedDate: '2 days ago',
    skills: ['Python', 'TensorFlow', 'NLP', 'ML', 'AWS'],
    description: 'Lead the design and deployment of large-scale ML systems, collaborating with cross-functional teams to build state-of-the-art NLP and recommendation features.'
  },
  {
    id: '2',
    title: 'Data Scientist',
    company: 'Netflix',
    location: 'Los Gatos, CA',
    salary: '$130,000 - $180,000',
    type: 'Full-time',
    matchScore: 88,
    matchReasons: ['Statistical analysis skills', 'Recommendation systems experience'],
    postedDate: '1 day ago',
    skills: ['Python', 'R', 'SQL', 'Statistics', 'A/B Testing'],
    description: 'Analyze product experiments and user behavior to inform content strategy and personalize experiences using advanced statistical modeling and causal inference.'
  },
  {
    id: '3',
    title: 'AI Research Engineer',
    company: 'OpenAI',
    location: 'San Francisco, CA',
    salary: '$160,000 - $220,000',
    type: 'Full-time',
    matchScore: 92,
    matchReasons: ['Research background', 'Deep learning expertise'],
    postedDate: '3 days ago',
    skills: ['PyTorch', 'Research', 'Deep Learning', 'Python', 'Papers'],
    description: 'Prototype and productionize cutting-edge deep learning models, collaborate on research papers, and translate findings into robust, user-facing capabilities.'
  }
]

const radarData = [
  { skill: 'Technical Skills', value: 85 },
  { skill: 'Experience Match', value: 90 },
  { skill: 'Culture Fit', value: 75 },
  { skill: 'Location Preference', value: 80 },
  { skill: 'Salary Range', value: 88 },
]

export function JobRecommendations() {
  const [jobs, setJobs] = useState<Job[]>(mockJobs)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState({
    location: '',
    salary: '',
    type: '',
    skills: ''
  })

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const getMatchScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100'
    if (score >= 80) return 'text-blue-600 bg-blue-100'
    if (score >= 70) return 'text-yellow-600 bg-yellow-100'
    return 'text-gray-600 bg-gray-100'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Job Recommendations</h1>
          <p className="text-gray-600 mt-2">
            AI-powered job matches based on your profile and preferences
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-primary-600" />
          <span className="text-sm text-gray-600">Last updated 2 minutes ago</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Job Listings */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
              <Filter className="h-5 w-5 text-gray-400" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="Location"
                value={filters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                className="input-field"
              />
              <select
                value={filters.salary}
                onChange={(e) => handleFilterChange('salary', e.target.value)}
                className="input-field"
              >
                <option value="">Salary Range</option>
                <option value="0-50k">$0 - $50k</option>
                <option value="50k-100k">$50k - $100k</option>
                <option value="100k-150k">$100k - $150k</option>
                <option value="150k+">$150k+</option>
              </select>
              <select
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="input-field"
              >
                <option value="">Job Type</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
              <input
                type="text"
                placeholder="Skills"
                value={filters.skills}
                onChange={(e) => handleFilterChange('skills', e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          {/* Job Cards */}
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">{job.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMatchScoreColor(job.matchScore)}`}>
                        {job.matchScore}% Match
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center">
                        <Building className="h-4 w-4 mr-1" />
                        {job.company}
                      </div>
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        {job.location}
                      </div>
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-1" />
                        {job.salary}
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {job.postedDate}
                      </div>
                    </div>

                    <div className="mb-3">
                      <p className="text-gray-700 text-sm line-clamp-2">
                        {job.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-4">
                      {job.skills.slice(0, 5).map((skill) => (
                        <span
                          key={skill}
                          className="px-2 py-1 bg-primary-100 text-primary-700 text-xs rounded-md"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>

                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Why this matches:</h4>
                      <ul className="space-y-1">
                        {job.matchReasons.map((reason, index) => (
                          <li key={index} className="text-sm text-gray-600 flex items-center">
                            <Star className="h-3 w-3 text-primary-500 mr-2" />
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <button className="btn-secondary">
                    Save Job
                  </button>
                  <button className="btn-primary">
                    Apply Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Match Analysis */}
        <div className="space-y-6">
          {/* Match Score Radar */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Match Analysis</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="skill" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar
                    name="Match Score"
                    dataKey="value"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Jobs Applied</span>
                <span className="text-sm font-medium text-gray-900">12</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Interviews Scheduled</span>
                <span className="text-sm font-medium text-gray-900">3</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Average Match Score</span>
                <span className="text-sm font-medium text-green-600">87%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Profile Views</span>
                <span className="text-sm font-medium text-gray-900">24</span>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">Applied to Senior ML Engineer at Google</p>
                  <p className="text-xs text-gray-500">2 hours ago</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">Resume viewed by Netflix recruiter</p>
                  <p className="text-xs text-gray-500">1 day ago</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">Interview scheduled with OpenAI</p>
                  <p className="text-xs text-gray-500">2 days ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 