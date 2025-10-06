'use client'

import { useState } from 'react'
import { 
  Upload, 
  FileText, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle,
  Download,
  Eye,
  BarChart3
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'

interface SkillAnalysis {
  skill: string
  level: number
  demand: number
  match: number
}

interface ResumeInsight {
  type: 'strength' | 'improvement' | 'warning'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
}

const mockSkills: SkillAnalysis[] = [
  { skill: 'Python', level: 85, demand: 90, match: 88 },
  { skill: 'Machine Learning', level: 78, demand: 85, match: 82 },
  { skill: 'SQL', level: 72, demand: 80, match: 76 },
  { skill: 'AWS', level: 65, demand: 75, match: 70 },
  { skill: 'React', level: 60, demand: 70, match: 65 },
]

const mockInsights: ResumeInsight[] = [
  {
    type: 'strength',
    title: 'Strong Technical Foundation',
    description: 'Your Python and ML skills are well-aligned with current market demands.',
    priority: 'high'
  },
  {
    type: 'improvement',
    title: 'Cloud Computing Skills',
    description: 'Consider adding AWS/Azure certifications to boost your profile.',
    priority: 'medium'
  },
  {
    type: 'warning',
    title: 'Frontend Development',
    description: 'React skills could be improved to increase job opportunities.',
    priority: 'low'
  }
]

const pieData = [
  { name: 'Technical Skills', value: 40, color: '#3b82f6' },
  { name: 'Experience', value: 30, color: '#10b981' },
  { name: 'Education', value: 15, color: '#f59e0b' },
  { name: 'Projects', value: 15, color: '#ef4444' },
]

export function ResumeAnalysis() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setUploadedFile(file)
      setLoading(true)
      // Simulate analysis
      setTimeout(() => {
        setAnalysisComplete(true)
        setLoading(false)
      }, 2000)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'strength': return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'improvement': return <TrendingUp className="h-5 w-5 text-blue-500" />
      case 'warning': return <AlertCircle className="h-5 w-5 text-yellow-500" />
      default: return <FileText className="h-5 w-5 text-gray-500" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Resume Analysis</h1>
          <p className="text-gray-600 mt-2">
            AI-powered resume analysis with personalized insights and recommendations
          </p>
        </div>
        {analysisComplete && (
          <button className="btn-secondary flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Export Report</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* File Upload */}
          <div className="card">
            <div className="text-center">
              {!uploadedFile ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Upload your resume
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Supported formats: PDF, DOC, DOCX (Max 10MB)
                  </p>
                  <label className="btn-primary cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    Choose File
                  </label>
                </div>
              ) : (
                <div className="border-2 border-dashed border-primary-300 rounded-lg p-8 bg-primary-50">
                  <FileText className="h-12 w-12 text-primary-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {uploadedFile.name}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  {loading && (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                      <span className="text-sm text-gray-600">Analyzing resume...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Analysis Results */}
          {analysisComplete && (
            <>
              {/* Skills Analysis */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills Analysis</h3>
                <div className="space-y-4">
                  {mockSkills.map((skill) => (
                    <div key={skill.skill} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{skill.skill}</span>
                          <span className="text-sm text-gray-600">{skill.match}% match</span>
                        </div>
                        <div className="flex space-x-4 text-sm text-gray-600">
                          <span>Your level: {skill.level}%</span>
                          <span>Market demand: {skill.demand}%</span>
                        </div>
                        <div className="mt-2 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${skill.match}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Insights */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Insights</h3>
                <div className="space-y-4">
                  {mockInsights.map((insight, index) => (
                    <div key={index} className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-gray-900">{insight.title}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(insight.priority)}`}>
                            {insight.priority} priority
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{insight.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Resume Score */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resume Score</h3>
            <div className="text-center">
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-gray-200"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={`${2 * Math.PI * 36}`}
                    strokeDashoffset={`${2 * Math.PI * 36 * (1 - 0.85)}`}
                    className="text-primary-600"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900">85%</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">Overall Resume Health</p>
            </div>
          </div>

          {/* Resume Composition */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Resume Composition</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {pieData.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span className="text-gray-700">{item.name}</span>
                  </div>
                  <span className="font-medium text-gray-900">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full btn-primary flex items-center justify-center space-x-2">
                <Eye className="h-4 w-4" />
                <span>Preview Resume</span>
              </button>
              <button className="w-full btn-secondary flex items-center justify-center space-x-2">
                <Download className="h-4 w-4" />
                <span>Download PDF</span>
              </button>
              <button className="w-full btn-secondary flex items-center justify-center space-x-2">
                <BarChart3 className="h-4 w-4" />
                <span>Compare with Market</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 