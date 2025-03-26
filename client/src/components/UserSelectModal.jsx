import { useState } from 'react';
import { Modal, Select } from 'antd';

const UserSelectModal = ({ visible, users, onSelect }) => {
  const [selectedUser, setSelectedUser] = useState(null);

  return (
    <Modal
      title="Select Your User"
      visible={visible}
      onOk={() => onSelect(selectedUser)}
      onCancel={() => {}}
      closable={false}
      okButtonProps={{ disabled: !selectedUser }}
    >
      <Select
        style={{ width: '100%' }}
        placeholder="Select your user"
        onChange={setSelectedUser}
        options={users.map(user => ({
          label: `${user.name} (${user.email})`,
          value: user.id
        }))}
      />
    </Modal>
  );
};

export default UserSelectModal;