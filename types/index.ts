// types/index.ts
export interface User {
  session_token: string
  tokens: number
  created_at: string
}

export interface CVData {
  session_token: string
  cv_file_url: string
  created_at: string
}

export interface CVAnalysis {
  career_level: string
  scenario: string
  strengths: string[]
  skills: string[]
  gaps: string[]
  ats_recommendations: string[]
  job_specific_insights?: string
}

export interface GeneratedDocuments {
  optimized_cv: string
  cover_letter: string
}
