import { Link } from 'react-router-dom'
import { HE } from '../constants/hebrew'

export default function NotFound() {
  return (
    <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50">
      <h1 className="text-2xl font-semibold text-gray-900">{HE.notFound.title}</h1>
      <p className="text-sm text-gray-500">{HE.notFound.message}</p>
      <Link to="/" className="text-sm text-primary-600 hover:underline">
        {HE.notFound.backHome}
      </Link>
    </div>
  )
}
