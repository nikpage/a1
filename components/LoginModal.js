import BaseModal from './BaseModal'
import LoginForm from './LoginForm'

export default function LoginModal({ show, onClose, onSuccess }) {
  return (
    <BaseModal show={show} onClose={onClose}>
      <LoginForm
        onLogin={(session, user) => {
          if (session && user) {
            onSuccess(session, user)
          }
        }}
      />
    </BaseModal>
  )
}
