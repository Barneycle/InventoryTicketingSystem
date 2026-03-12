import { useState } from 'react'
import Modal from '../ui/Modal'
import ItemForm from './ItemForm'
import Button from '../ui/Button'
import { useCreateItem, useUpdateItem, useItems } from '../../hooks/useItems'
import { useCategories } from '../../hooks/useCategories'
import { useBranches } from '../../hooks/useBranches'
import { useOsOptions } from '../../hooks/useOsOptions'
import { useProfiles } from '../../hooks/useProfiles'
import { useToast } from '../../contexts/ToastContext'

export default function ItemModal({ open, onClose, item }) {
  const toast = useToast()
  const { data: allItems } = useItems()
  const { data: categories } = useCategories()
  const { data: branches } = useBranches()
  const { data: osOptions } = useOsOptions()
  const { data: profiles = [] } = useProfiles()

  const existingCategories = (categories ?? []).map(c => c.name)
  const existingBranches = (branches ?? []).map(b => b.name)
  const existingOsOptions = (osOptions ?? []).map(o => o.name)
  const createItem = useCreateItem()
  const updateItem = useUpdateItem()
  const [error, setError] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)

  const loading = createItem.isPending || updateItem.isPending

  async function handleSubmit(data) {
    setError('')
    try {
      if (item) {
        await updateItem.mutateAsync({ id: item.id, ...data })
        toast(`"${data.model || data.brand}" updated successfully`)
      } else {
        await createItem.mutateAsync(data)
        toast(`"${data.model || data.brand}" added to inventory`)
      }
      setIsDirty(false)
      onClose()
    } catch (err) {
      setError(err.message ?? 'Something went wrong. Check the browser console for details.')
    }
  }

  function handleClose() {
    if (isDirty) { setConfirmClose(true); return }
    setError('')
    setIsDirty(false)
    onClose()
  }

  function forceClose() {
    setError('')
    setIsDirty(false)
    setConfirmClose(false)
    onClose()
  }

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={item ? 'Edit Item' : 'Add Item'}
        size="fit"
      >
        {loading && (
          <p className="mb-3 text-sm text-blue-600 dark:text-blue-400 font-medium" aria-live="polite">
            Saving your changes…
          </p>
        )}
        {error && (
          <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
        <ItemForm
          item={item}
          existingCategories={existingCategories}
          existingBranches={existingBranches}
          existingOsOptions={existingOsOptions}
          existingItems={allItems}
          existingProfiles={profiles}
          onSubmit={handleSubmit}
          onCancel={handleClose}
          onDirtyChange={setIsDirty}
          loading={loading}
        />
      </Modal>

      {/* Unsaved changes confirmation */}
      {confirmClose && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-zinc-50 dark:bg-gray-900 rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-gray-300 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50 mb-1">Discard changes?</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              You have unsaved changes. If you close now they will be lost.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirmClose(false)}>Keep editing</Button>
              <Button variant="danger" onClick={forceClose}>Discard</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
