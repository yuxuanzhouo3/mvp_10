'use client'

import { useState } from 'react'
import { 
  Video, 
  Mic, 
  MicOff, 
  Play, 
  Pause, 
  Square,
  MessageSquare,
  Clock,
  TrendingUp
} from 'lucide-react'

export function InterviewSimulator() {
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [feedback, setFeedback] = useState<any>(null)

  const questions = [
    "Tell me about a challenging project you worked on and how you overcame obstacles.",
    "How do you stay updated with the latest technologies in your field?",
    "Describe a situation where you had to work with a difficult team member.",
    "What are your career goals for the next 5 years?",
    "How do you handle tight deadlines and pressure?"
  ]

  const startInterview = () => {
    setIsRecording(true)
    setCurrentQuestion(0)
  }

  const stopInterview = () => {
    setIsRecording(false)
    setIsPlaying(false)
    // Simulate feedback generation
    setTimeout(() => {
      setFeedback({
        technicalAccuracy: 85,
        communication: 92,
        confidence: 78,
        suggestions: [
          "Try to provide more specific examples",
          "Practice speaking more slowly",
          "Include quantifiable results in your answers"
        ]
      })
    }, 1000)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Interview Simulator</h1>
          <p className="text-gray-600 mt-2">
            AI-powered interview practice with real-time feedback
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-primary-600" />
          <span className="text-sm text-gray-600">Practice makes perfect</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interview Interface */}
        <div className="space-y-6">
          <div className="card">
            <div className="text-center mb-6">
              <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="h-12 w-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {isRecording ? 'Interview in Progress' : 'Ready to Start'}
              </h3>
              <p className="text-gray-600">
                {isRecording 
                  ? 'Speak clearly and naturally' 
                  : 'Click start to begin your practice interview'
                }
              </p>
            </div>

            {isRecording && (
              <div className="text-center mb-6">
                <div className="flex items-center justify-center space-x-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-sm text-gray-600">Recording</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">02:34</span>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Current Question:</h4>
                  <p className="text-gray-700">{questions[currentQuestion]}</p>
                </div>
              </div>
            )}

            <div className="flex justify-center space-x-4">
              {!isRecording ? (
                <button
                  onClick={startInterview}
                  className="btn-primary flex items-center space-x-2"
                >
                  <Play className="h-4 w-4" />
                  <span>Start Interview</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    <span>{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>
                  <button
                    onClick={stopInterview}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <Square className="h-4 w-4" />
                    <span>End Interview</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Question Bank */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Question Bank</h3>
            <div className="space-y-3">
              {questions.map((question, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    currentQuestion === index && isRecording
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setCurrentQuestion(index)}
                >
                  <p className="text-sm text-gray-700">{question}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Feedback and Analysis */}
        <div className="space-y-6">
          {feedback ? (
            <>
              {/* Performance Metrics */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Analysis</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Technical Accuracy</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${feedback.technicalAccuracy}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{feedback.technicalAccuracy}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Communication</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${feedback.communication}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{feedback.communication}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Confidence</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-yellow-500 h-2 rounded-full"
                          style={{ width: `${feedback.confidence}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{feedback.confidence}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Suggestions */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Improvement Suggestions</h3>
                <div className="space-y-3">
                  {feedback.suggestions.map((suggestion: string, index: number) => (
                    <div key={index} className="flex items-start space-x-3">
                      <MessageSquare className="h-4 w-4 text-primary-600 mt-0.5" />
                      <p className="text-sm text-gray-700">{suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="card">
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Feedback Yet</h3>
                <p className="text-gray-600">
                  Complete an interview session to receive personalized feedback and suggestions.
                </p>
              </div>
            </div>
          )}

          {/* Practice History */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Practice History</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Technical Interview</p>
                  <p className="text-xs text-gray-500">2 days ago</p>
                </div>
                <span className="text-sm font-medium text-green-600">85%</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Behavioral Interview</p>
                  <p className="text-xs text-gray-500">1 week ago</p>
                </div>
                <span className="text-sm font-medium text-blue-600">78%</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">System Design</p>
                  <p className="text-xs text-gray-500">2 weeks ago</p>
                </div>
                <span className="text-sm font-medium text-yellow-600">72%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 