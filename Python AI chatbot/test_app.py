"""
Automated Test Suite for SmartAI Backend
Verifies SQLite database, API routes, CRUD operations, settings, and health check.
"""

import unittest
import json
import os
import tempfile
import app as application

class SmartAIChatbotTestCase(unittest.TestCase):

    def setUp(self):
        application.app.config['TESTING'] = True
        self.client = application.app.test_client()
        # Initialize database
        application.init_db()

    def test_health_check(self):
        """Test the health check endpoint."""
        res = self.client.get('/api/health')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get('status'), 'healthy')
        self.assertIn('mode', data)

    def test_settings_get_and_post(self):
        """Test retrieving and saving settings."""
        # GET settings
        res = self.client.get('/api/settings')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('model', data)
        self.assertIn('theme', data)

        # POST update settings
        new_settings = {
            'model': 'google/gemini-2.0-flash-001',
            'theme': 'dark',
            'system_prompt': 'You are a test assistant.'
        }
        res2 = self.client.post('/api/settings',
                                data=json.dumps(new_settings),
                                content_type='application/json')
        self.assertEqual(res2.status_code, 200)
        res_data = res2.get_json()
        self.assertTrue(res_data.get('success'))

    def test_chat_and_conversation_lifecycle(self):
        """Test chat message submission, conversation creation, listing, renaming, and deletion."""
        # 1. Send first message (Demo mode)
        chat_payload = {
            'message': 'Explain Python programming and decorators with examples.'
        }
        res = self.client.post('/api/chat',
                               data=json.dumps(chat_payload),
                               content_type='application/json')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get('success'))
        conv_id = data.get('conversation_id')
        self.assertIsNotNone(conv_id)
        self.assertIn('Python', data.get('title'))
        self.assertEqual(data['message']['role'], 'assistant')
        ai_msg_id = data['message']['id']

        # 2. List conversations
        res_list = self.client.get('/api/chats')
        self.assertEqual(res_list.status_code, 200)
        chats_data = res_list.get_json()
        chat_ids = [c['id'] for c in chats_data.get('chats', [])]
        self.assertIn(conv_id, chat_ids)

        # 3. Search conversations
        res_search = self.client.get('/api/chats?q=Python')
        self.assertEqual(res_search.status_code, 200)
        search_data = res_search.get_json()
        self.assertTrue(len(search_data.get('chats', [])) > 0)

        # 4. Get single conversation
        res_single = self.client.get(f'/api/chats/{conv_id}')
        self.assertEqual(res_single.status_code, 200)
        single_data = res_single.get_json()
        self.assertEqual(len(single_data.get('messages', [])), 2)  # 1 user + 1 assistant

        # 5. Rename conversation
        res_rename = self.client.put(f'/api/chats/{conv_id}',
                                     data=json.dumps({'title': 'Renamed Python Discussion'}),
                                     content_type='application/json')
        self.assertEqual(res_rename.status_code, 200)
        self.assertEqual(res_rename.get_json().get('title'), 'Renamed Python Discussion')

        # 6. Regenerate message
        res_regen = self.client.post(f'/api/messages/{ai_msg_id}/regenerate',
                                     data=json.dumps({}),
                                     content_type='application/json')
        self.assertEqual(res_regen.status_code, 200)
        self.assertTrue(res_regen.get_json().get('success'))

        # 7. Delete single message
        res_del_msg = self.client.delete(f'/api/messages/{ai_msg_id}')
        self.assertEqual(res_del_msg.status_code, 200)

        # 8. Delete conversation
        res_del_conv = self.client.delete(f'/api/chats/{conv_id}')
        self.assertEqual(res_del_conv.status_code, 200)

        # Verify deleted
        res_check = self.client.get(f'/api/chats/{conv_id}')
        self.assertEqual(res_check.status_code, 404)

if __name__ == '__main__':
    unittest.main()
