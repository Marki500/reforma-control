import { useEffect, useState } from 'react'
import { MoreVertical, Share2 } from 'lucide-react'
import { AppIcon } from '../brand/AppIcon'
import { BrandMark } from '../brand/Brand'
import { Modal } from '../ui/Modal'

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export default function InstallApp() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [installed, setInstalled] = useState(() => isStandalone())
  const [helpOpen, setHelpOpen] = useState(false)
  const isAppleMobile = /iphone|ipad|ipod/i.test(navigator.userAgent)

  useEffect(() => {
    function onInstallAvailable(event) {
      event.preventDefault()
      setInstallPrompt(event)
    }
    function onInstalled() {
      setInstalled(true)
      setInstallPrompt(null)
      setHelpOpen(false)
    }
    window.addEventListener('beforeinstallprompt', onInstallAvailable)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallAvailable)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (!installPrompt) {
      setHelpOpen(true)
      return
    }
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === 'accepted') setInstalled(true)
    setInstallPrompt(null)
  }

  if (installed) return null

  return (
    <>
      <button type="button" onClick={install} className="mb-1 flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-white/45 transition-all hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta">
        <AppIcon name="install" size={19} />
        <span>Instalar NIVEL</span>
      </button>
      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Instalar NIVEL">
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-xl bg-stone-50 p-3">
            <BrandMark className="h-12 w-12 shrink-0 text-stone-900" />
            <div><p className="font-semibold text-stone-900">NIVEL en tu móvil</p><p className="text-sm text-stone-500">Se abrirá a pantalla completa como una app.</p></div>
          </div>
          {isAppleMobile ? <div className="space-y-3 text-sm text-stone-600">
            <p>En iPhone o iPad, abre NIVEL en Safari y sigue estos pasos:</p>
            <ol className="space-y-3">
              <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-900 text-xs font-bold text-white">1</span><span className="pt-1">Pulsa <strong className="inline-flex items-center gap-1 text-stone-800"><Share2 size={15} /> Compartir</strong>.</span></li>
              <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-900 text-xs font-bold text-white">2</span><span className="pt-1">Elige <strong className="text-stone-800">Añadir a pantalla de inicio</strong>.</span></li>
              <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone-900 text-xs font-bold text-white">3</span><span className="pt-1">Confirma pulsando <strong className="text-stone-800">Añadir</strong>.</span></li>
            </ol>
          </div> : <div className="space-y-3 text-sm text-stone-600">
            <p>Si el botón de instalación no aparece automáticamente:</p>
            <div className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-900 text-white"><MoreVertical size={17} /></span><p>Abre el menú de Chrome o Edge y selecciona <strong className="text-stone-800">Instalar aplicación</strong> o <strong className="text-stone-800">Añadir a pantalla de inicio</strong>.</p></div>
          </div>}
          <button type="button" onClick={() => setHelpOpen(false)} className="w-full rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800">Entendido</button>
        </div>
      </Modal>
    </>
  )
}
