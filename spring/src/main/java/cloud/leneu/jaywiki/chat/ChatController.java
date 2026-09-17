package cloud.leneu.jaywiki.chat;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/chat")
public class ChatController {
    private final ChatRoomService roomService;

    @GetMapping("/state")
    public ChatRoomState state() {
        return roomService.state();
    }

    @PostMapping("/simulate/join")
    public ChatRoomState addVirtualUsers(@Valid @RequestBody ChatSimulateRequest request) {
        roomService.addVirtualUsers(request.count());
        return roomService.state();
    }

    @PostMapping("/simulate/leave")
    public ChatRoomState removeVirtualUsers(@Valid @RequestBody ChatSimulateRequest request) {
        roomService.removeVirtualUsers(request.count());
        return roomService.state();
    }

    @PostMapping("/reset")
    public ChatRoomState reset() {
        roomService.reset();
        return roomService.state();
    }
}
