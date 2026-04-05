import { FileText, Lock } from 'lucide-react'
import { getDocumentUrl } from '../api'

function parsePageNumber(sourceRef) {
  if (!sourceRef) return null
  const match = sourceRef.match(/page\s*(\d+)/i)
  return match ? parseInt(match[1], 10) : null
}

export default function DocumentPreview({ documentId, sourceRef, revealed }) {
  if (!documentId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        <div className="text-center space-y-2">
          <FileText className="h-10 w-10 mx-auto opacity-30" />
          <p>No document linked</p>
        </div>
      </div>
    )
  }

  const url = getDocumentUrl(documentId)
  const page = parsePageNumber(sourceRef)
  const displayUrl = revealed && page ? `${url}#page=${page}` : url

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          Source Document
        </span>
        {revealed && page && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
            Page {page}
          </span>
        )}
        {!revealed && (
          <span className="text-xs text-muted-foreground italic">
            Revealed after answering
          </span>
        )}
      </div>

      <div className="flex-1 relative overflow-hidden">
        <iframe
          key={displayUrl}
          src={displayUrl}
          className="w-full h-full border-0"
          title="Document preview"
        />
        {!revealed && (
          <div className="absolute inset-0 backdrop-blur-sm bg-background/60 transition-all duration-500">
            <div className="h-full flex items-center justify-center">
              <div className="text-center space-y-2">
                <Lock className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">
                  Answer the question to reveal
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
