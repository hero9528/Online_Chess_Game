# Chess Game - Online Multiplayer 🎮

एक सुंदर और एनिमेटेड चेस गेम वेब एप्लिकेशन जहाँ आप स्थानीय रूप से, कंप्यूटर के साथ, या ऑनलाइन दोस्तों के साथ खेल सकते हैं!

## Features ✨

### 🎮 Game Modes
- **🏠 Local Game**: दो स्थानीय खिलाड़ी एक साथ खेल सकते हैं
- **🌐 Online Game**: दोस्तों के साथ ऑनलाइन खेलें
- **🤖 vs Computer**: कंप्यूटर के साथ खेलें

### 👥 Social Features
- **🔐 Simple Login System**: Username से login/create account करें
- **🔍 User Search**: Username से दोस्तों को खोजें
- **👫 Friend System**: Friend requests भेजें और accept करें
- **🎯 Challenge Friends**: दोस्तों को chess game के लिए challenge करें

### 💬 Chat Features
- **💬 Real-time Chat**: Game के दौरान chat करें
- **😀 Emoji Support**: Emoji picker के साथ emoji भेजें
- **⌨️ Typing Indicators**: जब कोई typing कर रहा हो तो indicator दिखता है

### 🎤 Voice Chat
- **🎤 Voice Chat**: Game के दौरान voice chat करें
- **🔇 Mute/Unmute**: Voice chat को mute/unmute करें

### 🎨 Game Features
- **✨ Smooth Animations**: पीस मूवमेंट के लिए स्मूथ एनिमेशन
- **♟️ Full Chess Rules**: सभी चेस पीस के लिए सही मूवमेंट नियम
- **🔄 Reset & Undo**: गेम रीसेट करें या अंतिम चाल वापस लें (local mode में)
- **📊 Game Status**: चेक, चेकमेट और स्टेलमेट की जानकारी
- **🎯 Captured Pieces**: दोनों खिलाड़ियों के कैप्चर किए गए पीस दिखाए जाते हैं

## Installation & Setup 🚀

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)

### Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ```
   या development mode के लिए:
   ```bash
   npm run dev
   ```

3. **Open in Browser**
   - Browser में जाएं: `http://localhost:3000`
   - Username enter करें और login करें
   - खेलना शुरू करें!

## कैसे खेलें 🎯

### Local Game
1. "Local Game" mode select करें
2. सफेद पीस पहले चलते हैं
3. किसी पीस पर क्लिक करके उसे सेलेक्ट करें
4. हरे रंग के स्क्वेयर पर क्लिक करके पीस को मूव करें
5. लाल रंग के स्क्वेयर दुश्मन पीस को कैप्चर करने के लिए हैं

### Online Game
1. Login करें (या नया account बनाएं)
2. "Friends" button पर click करें
3. Username search करें और friend request भेजें
4. Friend request accept करें
5. Friend को challenge करें
6. Game start होने पर chat और voice chat का उपयोग करें

### vs Computer
1. "vs Computer" mode select करें
2. Computer automatically black pieces के साथ खेलेगा
3. आप white pieces के साथ खेलेंगे

## Controls 🎮

- **Click**: पीस सेलेक्ट करने और मूव करने के लिए
- **Reset Button**: नया गेम शुरू करने के लिए
- **Undo Button**: अंतिम चाल वापस लेने के लिए (local mode में)
- **Friends Button**: Friends sidebar खोलने/बंद करने के लिए
- **Chat Panel**: Game के दौरान chat करने के लिए
- **Voice Chat Button**: Voice chat start/stop करने के लिए

## Game Rules 📜

- **Pawn**: एक स्क्वेयर आगे या शुरुआत में दो स्क्वेयर आगे, डायगोनली कैप्चर
- **Rook**: सीधी रेखा में किसी भी दिशा में
- **Knight**: L-आकार में चलता है
- **Bishop**: डायगोनली किसी भी दिशा में
- **Queen**: सीधी या डायगोनली किसी भी दिशा में
- **King**: किसी भी दिशा में एक स्क्वेयर

## Browser Support 🌐

सभी आधुनिक ब्राउज़रों में काम करता है:
- Chrome (recommended)
- Firefox
- Edge
- Safari

**Note**: Voice chat के लिए microphone permission की आवश्यकता है।

## Files 📁

- `index.html` - मुख्य HTML structure
- `style.css` - सुंदर CSS styling और animations
- `script.js` - चेस गेम logic, online features, chat, और voice chat
- `server.js` - Node.js server with Socket.io
- `package.json` - Dependencies और scripts

## Technologies Used 🛠️

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Node.js, Express
- **Real-time Communication**: Socket.io
- **Voice Chat**: WebRTC (Peer-to-Peer)

## Features in Detail 🔍

### Login System
- Simple username-based authentication
- No password required (for simplicity)
- Username uniqueness check

### Friend System
- Search users by username
- Send and accept friend requests
- See online/offline status
- Challenge friends to play

### Chat System
- Real-time messaging during games
- Emoji picker with 24+ emojis
- Typing indicators
- Timestamp for each message

### Voice Chat
- WebRTC-based peer-to-peer voice chat
- Mute/unmute functionality
- Automatic connection when both players enable

---

**Enjoy Playing Chess Online! ♟️🎮**
