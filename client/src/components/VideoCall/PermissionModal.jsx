import { Modal, Button } from 'antd';

const PermissionModal = ({ visible, onRetry, onCancel }) => {
  return (
    <Modal
      title="Permissions Required"
      visible={visible}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button key="retry" type="primary" onClick={onRetry}>
          Allow Access
        </Button>,
      ]}
    >
      <p>Please enable microphone and camera permissions to use the video call features.</p>
    </Modal>
  );
};

export default PermissionModal;